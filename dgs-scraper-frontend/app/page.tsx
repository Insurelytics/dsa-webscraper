"use client"

import { useState, useEffect } from "react"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { CalendarDays, Download, Settings, BarChart3, Clock, Save } from "lucide-react"
import CountySelection from "@/components/county-selection"
import ScheduleSettings from "@/components/schedule-settings"
import JobMonitor from "@/components/job-monitor"
import ResultsAndFilters from "@/components/results-and-filters"
import { apiClient } from "@/lib/api"

export default function DGSScraperDashboard() {
  const [activeTab, setActiveTab] = useState("dashboard")
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [dashboardStats, setDashboardStats] = useState({
    totalProjects: 0,
    strongLeads: 0,
    weakLeads: 0,
    watchlist: 0,
    ignored: 0,
    lastFullScrape: "",
    runningJobs: 0,
    completedJobs: 0,
    failedJobs: 0,
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true)
        setError(null)
        
        const [stats, categories] = await Promise.all([
          apiClient.getStats(),
          apiClient.getCategories()
        ])

        setDashboardStats({
          totalProjects: stats.total_projects || 0,
          strongLeads: categories.strongLeads?.count || 0,
          weakLeads: categories.weakLeads?.count || 0,
          watchlist: categories.watchlist?.count || 0,
          ignored: categories.ignored?.count || 0,
          lastFullScrape: stats.last_updated || "",
          runningJobs: 0, // TODO: Get from job monitoring
          completedJobs: 0, // TODO: Get from job history
          failedJobs: 0, // TODO: Get from job history
        })
      } catch (err) {
        console.error('Failed to fetch dashboard data:', err)
        setError('Failed to load dashboard data. Please check if the backend server is running.')
      } finally {
        setLoading(false)
      }
    }

    fetchDashboardData()
  }, [])

  const handleSaveChanges = () => {
    console.log("Saving all changes to backend...")
    setHasUnsavedChanges(false)
    // This will eventually sync all settings to the backend
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 text-xl mb-4">⚠ Error</div>
          <p className="text-gray-600 mb-4">{error}</p>
          <Button onClick={() => window.location.reload()}>
            Retry
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto p-6">
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">DGS School Projects Scraper</h1>
              <p className="text-gray-600">
                Automated scraping and categorization of California school construction projects
              </p>
            </div>
            <div className="flex items-center space-x-4">
              {hasUnsavedChanges && (
                <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
                  <Clock className="w-3 h-3 mr-1" />
                  Unsaved Changes
                </Badge>
              )}
              <Button onClick={handleSaveChanges} disabled={!hasUnsavedChanges} className="flex items-center">
                <Save className="w-4 h-4 mr-2" />
                Save All Changes
              </Button>
            </div>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="counties">Counties</TabsTrigger>
            <TabsTrigger value="schedule">Schedule</TabsTrigger>
            <TabsTrigger value="jobs">Job Monitor</TabsTrigger>
            <TabsTrigger value="results">Results & Filters</TabsTrigger>
          </TabsList>

          {/* Dashboard Tab */}
          {activeTab === "dashboard" && (
            <div className="space-y-6">
              {/* Key Statistics */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Projects</CardTitle>
                    <BarChart3 className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{dashboardStats.totalProjects.toLocaleString()}</div>
                    <p className="text-xs text-muted-foreground">
                      All scraped projects
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Strong Leads</CardTitle>
                    <Badge className="bg-green-100 text-green-700">{dashboardStats.strongLeads}</Badge>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{dashboardStats.strongLeads.toLocaleString()}</div>
                    <p className="text-xs text-muted-foreground">
                      High-value projects (≥$2M)
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Weak Leads</CardTitle>
                    <Badge className="bg-yellow-100 text-yellow-700">{dashboardStats.weakLeads}</Badge>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{dashboardStats.weakLeads.toLocaleString()}</div>
                    <p className="text-xs text-muted-foreground">
                      Medium-value projects (≥$1M)
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Watchlist</CardTitle>
                    <Badge className="bg-blue-100 text-blue-700">{dashboardStats.watchlist}</Badge>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{dashboardStats.watchlist.toLocaleString()}</div>
                    <p className="text-xs text-muted-foreground">
                      Potential projects (≥$100K)
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Recent Activity */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Recent Activity</CardTitle>
                    <CardDescription>Latest scraping jobs and system activity</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex items-center space-x-4">
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        <div className="flex-1">
                          <p className="text-sm font-medium">Last full scrape completed</p>
                          <p className="text-xs text-muted-foreground">{dashboardStats.lastFullScrape || 'Never'}</p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-4">
                        <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                        <div className="flex-1">
                          <p className="text-sm font-medium">Database updated</p>
                          <p className="text-xs text-muted-foreground">{dashboardStats.totalProjects} total projects</p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-4">
                        <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                        <div className="flex-1">
                          <p className="text-sm font-medium">Categories refreshed</p>
                          <p className="text-xs text-muted-foreground">Projects automatically categorized</p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>System Status</CardTitle>
                    <CardDescription>Current system performance and health</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Running Jobs</span>
                        <Badge variant={dashboardStats.runningJobs > 0 ? "default" : "secondary"}>
                          {dashboardStats.runningJobs}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Completed Jobs</span>
                        <Badge variant="outline">{dashboardStats.completedJobs}</Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Failed Jobs</span>
                        <Badge variant={dashboardStats.failedJobs > 0 ? "destructive" : "outline"}>
                          {dashboardStats.failedJobs}
                        </Badge>
                      </div>
                      <div className="pt-2">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium">System Health</span>
                          <span className="text-sm text-green-600">Excellent</span>
                        </div>
                        <Progress value={95} className="h-2" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

          {/* Counties Tab */}
          {activeTab === "counties" && (
            <CountySelection 
              onSettingsChange={() => setHasUnsavedChanges(true)}
            />
          )}

          {/* Schedule Tab */}
          {activeTab === "schedule" && (
            <ScheduleSettings 
              onSettingsChange={() => setHasUnsavedChanges(true)}
            />
          )}

          {/* Job Monitor Tab */}
          {activeTab === "jobs" && <JobMonitor />}

          {/* Results & Filters Tab */}
          {activeTab === "results" && (
            <ResultsAndFilters 
              onSettingsChange={() => setHasUnsavedChanges(true)}
            />
          )}
        </Tabs>
      </div>
    </div>
  )
}
