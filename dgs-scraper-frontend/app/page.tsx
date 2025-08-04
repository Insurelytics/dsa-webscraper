"use client"

import { useState } from "react"
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

// Placeholder data
const dashboardStats = {
  totalProjects: 15742,
  strongLeads: 1234,
  weakLeads: 2456,
  watchlist: 3789,
  ignored: 8263,
  lastFullScrape: "2024-01-15 14:30:00",
  runningJobs: 2,
  completedJobs: 15,
  failedJobs: 1,
}

export default function DGSScraperDashboard() {
  const [activeTab, setActiveTab] = useState("dashboard")
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)

  const handleSaveChanges = () => {
    console.log("Saving all changes to backend...")
    setHasUnsavedChanges(false)
    // This will eventually sync all settings to the backend
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
                <Badge variant="secondary" className="animate-pulse">
                  Unsaved Changes
                </Badge>
              )}
              <Button
                onClick={handleSaveChanges}
                disabled={!hasUnsavedChanges}
                className={`${
                  hasUnsavedChanges
                    ? "bg-blue-600 hover:bg-blue-700 shadow-lg relative overflow-hidden"
                    : "bg-gray-400 cursor-not-allowed"
                } transition-all duration-200`}
              >
                {hasUnsavedChanges && (
                  <div
                    className="absolute inset-0 -top-[1px] -bottom-[1px] bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer"
                    style={{
                      background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)",
                      animation: "shimmer 2s infinite",
                    }}
                  />
                )}
                <Save className="h-4 w-4 mr-2 relative z-10" />
                <span className="relative z-10">Save Changes</span>
              </Button>
            </div>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="dashboard" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Dashboard
            </TabsTrigger>
            <TabsTrigger value="counties" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Counties
            </TabsTrigger>
            <TabsTrigger value="results" className="flex items-center gap-2">
              <Download className="h-4 w-4" />
              Results & Filters
            </TabsTrigger>
            <TabsTrigger value="schedule" className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4" />
              Schedule
            </TabsTrigger>
            <TabsTrigger value="jobs" className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Jobs
            </TabsTrigger>
          </TabsList>

          <div className="space-y-6">
            {/* Dashboard Tab */}
            <div className={`${activeTab === "dashboard" ? "block" : "hidden"}`}>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Projects</CardTitle>
                    <BarChart3 className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{dashboardStats.totalProjects.toLocaleString()}</div>
                    <p className="text-xs text-muted-foreground">Last updated: {dashboardStats.lastFullScrape}</p>
                  </CardContent>
                </Card>

                <Card
                  className="cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => setActiveTab("results")}
                >
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Strong Leads</CardTitle>
                    <Badge variant="default" className="bg-green-500">
                      High
                    </Badge>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-green-600">
                      {dashboardStats.strongLeads.toLocaleString()}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {((dashboardStats.strongLeads / dashboardStats.totalProjects) * 100).toFixed(1)}% of total
                    </p>
                  </CardContent>
                </Card>

                <Card
                  className="cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => setActiveTab("results")}
                >
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Weak Leads</CardTitle>
                    <Badge variant="secondary" className="bg-yellow-500">
                      Medium
                    </Badge>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-yellow-600">
                      {dashboardStats.weakLeads.toLocaleString()}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {((dashboardStats.weakLeads / dashboardStats.totalProjects) * 100).toFixed(1)}% of total
                    </p>
                  </CardContent>
                </Card>

                <Card
                  className="cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => setActiveTab("results")}
                >
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Watchlist</CardTitle>
                    <Badge variant="outline" className="border-blue-500 text-blue-500">
                      Watch
                    </Badge>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-blue-600">{dashboardStats.watchlist.toLocaleString()}</div>
                    <p className="text-xs text-muted-foreground">
                      {((dashboardStats.watchlist / dashboardStats.totalProjects) * 100).toFixed(1)}% of total
                    </p>
                  </CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Recent Activity</CardTitle>
                    <CardDescription>Latest scraping jobs and updates</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                      <div>
                        <p className="font-medium">Sacramento County</p>
                        <p className="text-sm text-gray-600">Completed 2 hours ago</p>
                      </div>
                      <Badge variant="default" className="bg-green-500">
                        Complete
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                      <div>
                        <p className="font-medium">Los Angeles County</p>
                        <p className="text-sm text-gray-600">In progress - 67% complete</p>
                      </div>
                      <Badge variant="default" className="bg-blue-500">
                        Running
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
                      <div>
                        <p className="font-medium">Watchlist Rescrape</p>
                        <p className="text-sm text-gray-600">Scheduled for tonight</p>
                      </div>
                      <Badge variant="secondary">Scheduled</Badge>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>System Status</CardTitle>
                    <CardDescription>Current job statistics and system health</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Running Jobs</span>
                        <span>{dashboardStats.runningJobs}</span>
                      </div>
                      <Progress value={(dashboardStats.runningJobs / 1) * 100} className="h-2" />
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Completed Jobs</span>
                        <span>{dashboardStats.completedJobs}</span>
                      </div>
                      <Progress value={Math.min((dashboardStats.completedJobs / 20) * 100, 100)} className="h-2" />
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Failed Jobs</span>
                        <span>{dashboardStats.failedJobs}</span>
                      </div>
                      <Progress value={(dashboardStats.failedJobs / 5) * 100} className="h-2" />
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Counties Tab */}
            <div className={`${activeTab === "counties" ? "block" : "hidden"}`}>
              <CountySelection onSettingsChange={setHasUnsavedChanges} />
            </div>

            {/* Results Tab */}
            <div className={`${activeTab === "results" ? "block" : "hidden"}`}>
              <ResultsAndFilters onSettingsChange={setHasUnsavedChanges} />
            </div>

            {/* Schedule Tab */}
            <div className={`${activeTab === "schedule" ? "block" : "hidden"}`}>
              <ScheduleSettings onSettingsChange={setHasUnsavedChanges} />
            </div>

            {/* Jobs Tab */}
            <div className={`${activeTab === "jobs" ? "block" : "hidden"}`}>
              <JobMonitor />
            </div>
          </div>
        </Tabs>
      </div>

      <style jsx>{`
        @keyframes shimmer {
          0% {
            transform: translateX(-100%);
          }
          100% {
            transform: translateX(100%);
          }
        }
      `}</style>
    </div>
  )
}
