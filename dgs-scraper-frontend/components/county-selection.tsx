"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Search, Play, Clock, CheckCircle, AlertCircle } from "lucide-react"
import { apiClient } from "@/lib/api"

interface CountySelectionProps {
  onSettingsChange: (hasChanges: boolean) => void
}

interface County {
  id: number
  name: string
  code: string
  enabled: boolean
  last_scraped: string | null
  total_projects: number
  current_projects: number
  last_job_completed: string | null
}

export default function CountySelection({ onSettingsChange }: CountySelectionProps) {
  const [counties, setCounties] = useState<County[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [showEnabledOnly, setShowEnabledOnly] = useState(false)
  const [scrapingCounties, setScrapingCounties] = useState<Set<string>>(new Set())
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [runningJobs, setRunningJobs] = useState<Set<string>>(new Set())

  useEffect(() => {
    loadCounties()
    loadRunningJobs()
  }, [])

  // Refresh running jobs every 5 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      loadRunningJobs()
    }, 5000)

    return () => clearInterval(interval)
  }, [])

  const loadCounties = async () => {
    try {
      setLoading(true)
      setError(null)
      const countiesData = await apiClient.getCounties()
      setCounties(countiesData as County[])
    } catch (err) {
      console.error('Failed to load counties:', err)
      setError('Failed to load counties. Please check if the backend server is running.')
    } finally {
      setLoading(false)
    }
  }

  const loadRunningJobs = async () => {
    try {
      const jobs = await apiClient.getAllJobs(50) as any[]
      const running = new Set<string>()
      jobs.forEach((job) => {
        if (job.status === 'running' || job.status === 'pending') {
          running.add(job.county_id)
        }
      })
      setRunningJobs(running)
    } catch (err) {
      console.error('Failed to load running jobs:', err)
    }
  }

  const filteredCounties = counties.filter((county) => {
    const matchesSearch = county.name.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesFilter = showEnabledOnly ? county.enabled : true
    return matchesSearch && matchesFilter
  })

  const handleCountyToggle = async (county: County) => {
    const newEnabled = !county.enabled

    try {
      await apiClient.updateCountyStatus(county.id, newEnabled)
      
      // Update local state
      setCounties(prev => prev.map(c => 
        c.id === county.id ? { ...c, enabled: newEnabled } : c
      ))
      
      setHasUnsavedChanges(false) // Changes are saved immediately
      onSettingsChange(false)
    } catch (error) {
      console.error('Failed to update county status:', error)
      alert('Failed to update county status. Please try again.')
    }
  }

  const handleScrapeNow = async (county: County) => {
    if (scrapingCounties.has(county.code) || runningJobs.has(county.code)) {
      return // Already scraping
    }

    try {
      setScrapingCounties(prev => new Set(prev).add(county.code))
      await apiClient.scrapeCounty(county.code)
      
      // Immediately add to running jobs
      setRunningJobs(prev => new Set(prev).add(county.code))
    } catch (error) {
      console.error('Failed to start scraping:', error)
      
      // Show specific error message if available
      if (error instanceof Error && error.message.includes('400')) {
        alert('Another scraping job is already running. Please wait for it to complete before starting a new job.')
      } else {
        alert('Failed to start scraping. Please try again.')
      }
    } finally {
      setScrapingCounties(prev => {
        const newSet = new Set(prev)
        newSet.delete(county.code)
        return newSet
      })
    }
  }

  const getStatusIcon = (county: County) => {
    if (scrapingCounties.has(county.code) || runningJobs.has(county.code)) {
      return <Play className="h-4 w-4 text-blue-500 animate-pulse" />
    }
    
    if (county.last_scraped || county.current_projects > 0) {
      return <CheckCircle className="h-4 w-4 text-green-500" />
    }
    
    return <Clock className="h-4 w-4 text-gray-400" />
  }

  const getStatusBadge = (county: County) => {
    if (scrapingCounties.has(county.code) || runningJobs.has(county.code)) {
      return (
        <Badge variant="default" className="bg-blue-500">
          Scraping...
        </Badge>
      )
    }
    
    if (county.last_scraped || county.current_projects > 0) {
      return (
        <Badge variant="default" className="bg-green-500">
          Complete
        </Badge>
      )
    }
    
    return <Badge variant="outline">Never Scraped</Badge>
  }

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Never'
    return new Date(dateStr).toLocaleString()
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
              <span className="ml-2">Loading counties...</span>
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
              <Button onClick={loadCounties}>Retry</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  const enabledCount = counties.filter(c => c.enabled).length

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>County Management</CardTitle>
          <CardDescription>
            Enable or disable counties for scraping. Enabled counties will be included in scheduled scraping jobs.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center space-x-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Search counties..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button variant="outline" onClick={() => setShowEnabledOnly(!showEnabledOnly)}>
              {showEnabledOnly ? "Show All" : "Show Enabled Only"}
            </Button>
          </div>

          <div className="text-sm text-gray-600">
            {enabledCount} of {counties.length} counties enabled for scraping
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredCounties.map((county) => (
          <Card
            key={county.id}
            className={`transition-all ${county.enabled ? "ring-2 ring-blue-500 bg-blue-50" : "hover:shadow-md"}`}
          >
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-3">
                  <Checkbox 
                    className="cursor-pointer"
                    checked={county.enabled} 
                    onCheckedChange={() => handleCountyToggle(county)} 
                  />
                  <div>
                    <h3 className="font-medium">{county.name}</h3>
                    <div className="space-y-1 mt-2">
                      <div className="flex items-center space-x-2 text-xs text-gray-600">
                        {getStatusIcon(county)}
                        <span>Projects: {county.current_projects}</span>
                      </div>
                      <div className="text-xs text-gray-500">
                        Last scraped: {formatDate(county.last_scraped)}
                      </div>
                      <div className="text-xs text-gray-500">
                        Total projects: {county.total_projects}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex flex-col items-end space-y-2">
                  {getStatusBadge(county)}
                  {county.enabled && !runningJobs.has(county.code) && !scrapingCounties.has(county.code) && (
                    <Button 
                      size="sm"
                      variant="outline"
                      onClick={() => handleScrapeNow(county)}
                      disabled={scrapingCounties.has(county.code)}
                      className="cursor-pointer"
                    >
                      Scrape Now
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredCounties.length === 0 && (
        <Card>
          <CardContent className="text-center py-12">
            <Search className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Counties Found</h3>
            <p className="text-gray-600">
              {searchTerm ? 'Try adjusting your search terms.' : 'No counties match the current filter.'}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
