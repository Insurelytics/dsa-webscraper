"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Square, RefreshCw, AlertCircle, CheckCircle, Clock, Play } from "lucide-react"
import { apiClient } from "@/lib/api"

interface Job {
  id: number
  county_id: string
  county_name?: string
  status: string
  started_at: string
  completed_at: string | null
  total_projects: number
  processed_projects: number
  success_count: number
  error_message: string | null
}

interface StopJobResponse {
  status: string
  message: string
}

export default function JobMonitor() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [actioningJobs, setActioningJobs] = useState<Set<number>>(new Set())

  useEffect(() => {
    loadJobs()
  }, [])

  // Auto-refresh jobs every 5 seconds if enabled
  useEffect(() => {
    if (!autoRefresh) return

    const interval = setInterval(() => {
      loadJobs(true) // Silent refresh
    }, 5000)

    return () => clearInterval(interval)
  }, [autoRefresh])

  const loadJobs = async (silent = false) => {
    try {
      if (!silent) {
        setLoading(true)
        setError(null)
      }
      
      const jobsData = await apiClient.getAllJobs(100) as Job[]
      setJobs(jobsData)
    } catch (err) {
      console.error('Failed to load jobs:', err)
      if (!silent) {
        setError('Failed to load jobs. Please check if the backend server is running.')
      }
    } finally {
      if (!silent) {
        setLoading(false)
      }
    }
  }

  const handleStopJob = async (jobId: number) => {
    if (actioningJobs.has(jobId)) return

    try {
      setActioningJobs(prev => new Set(prev).add(jobId))
      const response = await apiClient.stopJob(jobId) as StopJobResponse
      
      // Handle response - refresh jobs regardless of result
      await loadJobs(true)
      
      if (response.status === 'no_action') {
        console.log('Stop job result:', response.message)
      }
    } catch (error) {
      console.error('Failed to stop job:', error)
      alert('Failed to stop job. Please try again.')
    } finally {
      setActioningJobs(prev => {
        const newSet = new Set(prev)
        newSet.delete(jobId)
        return newSet
      })
    }
  }

  const handleRetryJob = async (jobId: number) => {
    if (actioningJobs.has(jobId)) return

    try {
      setActioningJobs(prev => new Set(prev).add(jobId))
      await apiClient.retryJob(jobId)
      await loadJobs(true) // Refresh jobs
    } catch (error) {
      console.error('Failed to retry job:', error)
      alert('Failed to retry job. Please try again.')
    } finally {
      setActioningJobs(prev => {
        const newSet = new Set(prev)
        newSet.delete(jobId)
        return newSet
      })
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "pending":
      case "running":
        return <Play className="h-4 w-4 text-blue-500" />
      case "completed":
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case "failed":
      case "stopped":
        return <AlertCircle className="h-4 w-4 text-red-500" />
      default:
        return <Clock className="h-4 w-4 text-gray-400" />
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return (
          <Badge variant="outline" className="bg-yellow-50 text-yellow-700">
            Pending
          </Badge>
        )
      case "running":
        return (
          <Badge variant="default" className="bg-blue-500">
            Running
          </Badge>
        )
      case "completed":
        return (
          <Badge variant="default" className="bg-green-500">
            Completed
          </Badge>
        )
      case "failed":
        return <Badge variant="destructive">Failed</Badge>
      case "stopped":
        return <Badge variant="secondary">Stopped</Badge>
      default:
        return <Badge variant="outline">Unknown</Badge>
    }
  }

  const formatDuration = (startTime: string, endTime?: string) => {
    if (!startTime) return 'N/A'
    
    const start = new Date(startTime)
    const end = endTime ? new Date(endTime) : new Date()
    const diffMs = end.getTime() - start.getTime()
    const diffMinutes = Math.floor(diffMs / (1000 * 60))
    const diffHours = Math.floor(diffMinutes / 60)

    if (diffHours > 0) {
      return `${diffHours}h ${diffMinutes % 60}m`
    } else {
      return `${diffMinutes}m`
    }
  }

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'N/A'
    return new Date(dateStr).toLocaleString()
  }

  const calculateProgress = (job: Job) => {
    if (job.total_projects === 0) return 0
    return Math.round((job.processed_projects / job.total_projects) * 100)
  }

  const runningJobs = jobs.filter((job) => job.status === "running" || job.status === "pending")
  const completedJobs = jobs.filter((job) => job.status === "completed")
  const failedJobs = jobs.filter((job) => job.status === "failed" || job.status === "stopped")

  if (loading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
              <span className="ml-2">Loading jobs...</span>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="p-6">
            <div className="text-center">
              <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
              <p className="text-red-600 mb-4">{error}</p>
              <Button onClick={() => loadJobs()}>Retry</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Job Monitor</CardTitle>
              <CardDescription>Monitor current and recent scraping jobs in real-time</CardDescription>
            </div>
            <div className="flex items-center space-x-2">
              <Button variant="outline" size="sm" onClick={() => setAutoRefresh(!autoRefresh)}>
                <RefreshCw className={`h-4 w-4 mr-2 ${autoRefresh ? "animate-spin" : ""}`} />
                {autoRefresh ? "Auto Refresh On" : "Auto Refresh Off"}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">{runningJobs.length}</div>
              <div className="text-sm text-blue-700">Running Jobs</div>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">{completedJobs.length}</div>
              <div className="text-sm text-green-700">Completed Jobs</div>
            </div>
            <div className="text-center p-4 bg-red-50 rounded-lg">
              <div className="text-2xl font-bold text-red-600">{failedJobs.length}</div>
              <div className="text-sm text-red-700">Failed/Stopped</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {jobs.map((job) => {
          const progress = calculateProgress(job)
          const isRunning = job.status === "running" || job.status === "pending"
          
          return (
            <Card key={job.id} className={`${isRunning ? "border-blue-500 bg-blue-50" : ""}`}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    {getStatusIcon(job.status)}
                    <div>
                      <CardTitle className="text-lg">
                        {job.county_name || `County ${job.county_id}`} Scrape
                      </CardTitle>
                      <CardDescription>County ID: {job.county_id}</CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    {getStatusBadge(job.status)}
                    <div className="flex space-x-1">
                      {isRunning && (
                        <Button 
                          size="sm" 
                          variant="outline" 
                          onClick={() => handleStopJob(job.id)}
                          disabled={actioningJobs.has(job.id)}
                        >
                          <Square className="h-4 w-4" />
                        </Button>
                      )}
                      {(job.status === "failed" || job.status === "stopped") && (
                        <Button 
                          size="sm" 
                          variant="outline" 
                          onClick={() => handleRetryJob(job.id)}
                          disabled={actioningJobs.has(job.id)}
                        >
                          <RefreshCw className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {isRunning && job.total_projects > 0 && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Progress</span>
                      <span>
                        {job.processed_projects.toLocaleString()} / {job.total_projects.toLocaleString()} (
                        {progress}%)
                      </span>
                    </div>
                    <Progress value={progress} className="h-3" />
                    <div className="text-sm text-gray-600">
                      Status: {job.status === "pending" ? "Waiting to start..." : "Processing projects..."}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Started:</span>
                    <div className="font-medium">{formatDate(job.started_at)}</div>
                  </div>
                  <div>
                    <span className="text-gray-600">Duration:</span>
                    <div className="font-medium">
                      {formatDuration(job.started_at, job.completed_at || undefined)}
                    </div>
                  </div>
                  <div>
                    <span className="text-gray-600">Projects Processed:</span>
                    <div className="font-medium">{job.processed_projects.toLocaleString()}</div>
                  </div>
                  <div>
                    <span className="text-gray-600">Success Count:</span>
                    <div className="font-medium text-green-600">{job.success_count.toLocaleString()}</div>
                  </div>
                </div>

                {job.status === "failed" && job.error_message && (
                  <div className="p-3 bg-red-50 rounded-lg text-sm">
                    <div className="flex justify-between mb-1">
                      <span className="text-red-700">Failed at:</span>
                      <span className="font-medium text-red-800">{formatDate(job.completed_at)}</span>
                    </div>
                    <div className="text-red-700">Error: {job.error_message}</div>
                  </div>
                )}

                {job.status === "completed" && (
                  <div className="p-3 bg-green-50 rounded-lg text-sm">
                    <div className="flex justify-between">
                      <span className="text-green-700">Completed at:</span>
                      <span className="font-medium text-green-800">{formatDate(job.completed_at)}</span>
                    </div>
                  </div>
                )}

                {job.status === "stopped" && (
                  <div className="p-3 bg-gray-50 rounded-lg text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-700">Stopped at:</span>
                      <span className="font-medium text-gray-800">{formatDate(job.completed_at)}</span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>

      {jobs.length === 0 && (
        <Card>
          <CardContent className="text-center py-12">
            <Clock className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Jobs Found</h3>
            <p className="text-gray-600">No scraping jobs have been created yet. Start a new job from the Counties tab.</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
