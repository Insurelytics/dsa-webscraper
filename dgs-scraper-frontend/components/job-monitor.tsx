"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Play, Pause, Square, RefreshCw, AlertCircle, CheckCircle, Clock } from "lucide-react"

// Placeholder data for active jobs
const initialJobs = [
  {
    id: "job-001",
    type: "County Scrape",
    target: "Los Angeles County",
    status: "running",
    progress: 67,
    startTime: "2024-01-15 14:30:00",
    estimatedCompletion: "2024-01-15 16:45:00",
    itemsProcessed: 1456,
    totalItems: 2180,
    currentItem: "Elementary School Modernization Project",
    errors: 3,
    warnings: 12,
  },
  {
    id: "job-002",
    type: "Watchlist Rescrape",
    target: "All Counties",
    status: "waiting",
    progress: 0,
    startTime: "",
    estimatedCompletion: "",
    itemsProcessed: 0,
    totalItems: 1024,
    currentItem: "Waiting for available slot",
    errors: 0,
    warnings: 0,
  },
  {
    id: "job-003",
    type: "Leads Rescrape",
    target: "Sacramento County",
    status: "waiting",
    progress: 0,
    startTime: "",
    estimatedCompletion: "",
    itemsProcessed: 0,
    totalItems: 89,
    currentItem: "Queued",
    errors: 0,
    warnings: 0,
  },
]

export default function JobMonitor() {
  const [jobs, setJobs] = useState(initialJobs)
  const [autoRefresh, setAutoRefresh] = useState(true)

  // Simulate job progress updates
  useEffect(() => {
    if (!autoRefresh) return

    const interval = setInterval(() => {
      setJobs((prevJobs) =>
        prevJobs.map((job) => {
          if (job.status === "running" && job.progress < 100) {
            const newProgress = Math.min(job.progress + Math.random() * 5, 100)
            const newItemsProcessed = Math.floor((newProgress / 100) * job.totalItems)

            return {
              ...job,
              progress: newProgress,
              itemsProcessed: newItemsProcessed,
              currentItem: newProgress >= 100 ? "Completed" : job.currentItem,
            }
          }
          return job
        }),
      )
    }, 3000)

    return () => clearInterval(interval)
  }, [autoRefresh])

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "running":
        return <Play className="h-4 w-4 text-blue-500" />
      case "completed":
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case "failed":
        return <AlertCircle className="h-4 w-4 text-red-500" />
      case "paused":
        return <Pause className="h-4 w-4 text-yellow-500" />
      case "waiting":
        return <Clock className="h-4 w-4 text-gray-500" />
      default:
        return <Clock className="h-4 w-4 text-gray-400" />
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
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
      case "paused":
        return <Badge variant="secondary">Paused</Badge>
      case "waiting":
        return <Badge variant="outline">Waiting</Badge>
      default:
        return <Badge variant="outline">Unknown</Badge>
    }
  }

  const handleJobAction = (jobId: string, action: string) => {
    console.log(`${action} job ${jobId}`)
    // Placeholder for job control functionality
  }

  const formatDuration = (startTime: string, endTime?: string) => {
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

  const runningJobs = jobs.filter((job) => job.status === "running")
  const waitingJobs = jobs.filter((job) => job.status === "waiting")
  const completedJobs = jobs.filter((job) => job.status === "completed")
  const failedJobs = jobs.filter((job) => job.status === "failed")

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
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <div className="text-2xl font-bold text-gray-600">{waitingJobs.length}</div>
              <div className="text-sm text-gray-700">Waiting Jobs</div>
            </div>
            <div className="text-center p-4 bg-red-50 rounded-lg">
              <div className="text-2xl font-bold text-red-600">{failedJobs.length}</div>
              <div className="text-sm text-red-700">Total Failed</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {jobs.map((job) => (
          <Card key={job.id} className={`${job.status === "running" ? "border-blue-500 bg-blue-50" : ""}`}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  {getStatusIcon(job.status)}
                  <div>
                    <CardTitle className="text-lg">{job.type}</CardTitle>
                    <CardDescription>{job.target}</CardDescription>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  {getStatusBadge(job.status)}
                  <div className="flex space-x-1">
                    {job.status === "running" && (
                      <>
                        <Button size="sm" variant="outline" onClick={() => handleJobAction(job.id, "pause")}>
                          <Pause className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => handleJobAction(job.id, "stop")}>
                          <Square className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                    {job.status === "failed" && (
                      <Button size="sm" variant="outline" onClick={() => handleJobAction(job.id, "retry")}>
                        <RefreshCw className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {job.status === "running" && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Progress</span>
                    <span>
                      {job.itemsProcessed.toLocaleString()} / {job.totalItems.toLocaleString()} (
                      {job.progress.toFixed(1)}%)
                    </span>
                  </div>
                  <Progress value={job.progress} className="h-3" />
                  <div className="text-sm text-gray-600">Currently processing: {job.currentItem}</div>
                </div>
              )}

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="text-gray-600">Started:</span>
                  <div className="font-medium">{job.startTime}</div>
                </div>
                <div>
                  <span className="text-gray-600">Duration:</span>
                  <div className="font-medium">
                    {formatDuration(job.startTime, job.completionTime || job.failureTime)}
                  </div>
                </div>
                <div>
                  <span className="text-gray-600">Items Processed:</span>
                  <div className="font-medium">{job.itemsProcessed.toLocaleString()}</div>
                </div>
                <div>
                  <span className="text-gray-600">Issues:</span>
                  <div className="font-medium">
                    {job.errors > 0 && <span className="text-red-600">{job.errors} errors</span>}
                    {job.errors > 0 && job.warnings > 0 && <span className="text-gray-400">, </span>}
                    {job.warnings > 0 && <span className="text-yellow-600">{job.warnings} warnings</span>}
                    {job.errors === 0 && job.warnings === 0 && <span className="text-green-600">None</span>}
                  </div>
                </div>
              </div>

              {job.status === "running" && job.estimatedCompletion && (
                <div className="p-3 bg-blue-50 rounded-lg text-sm">
                  <div className="flex justify-between">
                    <span className="text-blue-700">Estimated completion:</span>
                    <span className="font-medium text-blue-800">{job.estimatedCompletion}</span>
                  </div>
                </div>
              )}

              {job.status === "failed" && (
                <div className="p-3 bg-red-50 rounded-lg text-sm">
                  <div className="flex justify-between">
                    <span className="text-red-700">Failed at:</span>
                    <span className="font-medium text-red-800">{job.failureTime}</span>
                  </div>
                  <div className="mt-1 text-red-700">Reason: {job.currentItem}</div>
                </div>
              )}

              {job.status === "completed" && (
                <div className="p-3 bg-green-50 rounded-lg text-sm">
                  <div className="flex justify-between">
                    <span className="text-green-700">Completed at:</span>
                    <span className="font-medium text-green-800">{job.completionTime}</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {jobs.length === 0 && (
        <Card>
          <CardContent className="text-center py-12">
            <Clock className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Active Jobs</h3>
            <p className="text-gray-600">All scraping jobs have completed. Start a new job from the Counties tab.</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
