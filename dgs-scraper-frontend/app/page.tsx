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
import ScoringCriteria from "@/components/scoring-criteria"
import { apiClient } from "@/lib/api"

export default function DGSScraperDashboard() {
  const [activeTab, setActiveTab] = useState("results")
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
  const [saveInProgress, setSaveInProgress] = useState(false)

  // Handle page unload warning
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault()
        e.returnValue = ''
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [hasUnsavedChanges])

  useEffect(() => {
    const fetchDashboardData = async (silent = false) => {
      try {
        if (!silent) {
          setLoading(true)
          setError(null)
        }
        
        const [stats, categories] = await Promise.all([
          apiClient.getStats(),
          apiClient.getCategories()
        ]) as [any, any]

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
        if (!silent) {
          setError('Failed to load dashboard data. Please check if the backend server is running.')
        }
      } finally {
        if (!silent) {
          setLoading(false)
        }
      }
    }

    fetchDashboardData()
    
    // Auto-refresh dashboard stats every 5 seconds (silent refresh)
    const interval = setInterval(() => {
      fetchDashboardData(true)
    }, 5000)

    return () => clearInterval(interval)
  }, [])

  const handleSaveChanges = async () => {
    console.log("Saving all changes to backend...")
    setSaveInProgress(true)
    
    try {
      // Call the appropriate save function based on active tab
      if (activeTab === "results" && (window as any).resultsAndFiltersSave) {
        await (window as any).resultsAndFiltersSave();
      } else if (activeTab === "criteria" && (window as any).scoringCriteriaSave) {
        await (window as any).scoringCriteriaSave();
      }
      // Add other tab save functions here as needed
      
      setHasUnsavedChanges(false)
    } catch (error) {
      console.error('Error saving changes:', error)
      alert('Failed to save changes. Please try again.')
    } finally {
      setSaveInProgress(false)
    }
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
              <Button 
                onClick={handleSaveChanges} 
                disabled={!hasUnsavedChanges || saveInProgress} 
                className={`${
                  hasUnsavedChanges && !saveInProgress
                    ? "bg-blue-600 hover:bg-blue-700 shadow-lg relative overflow-hidden"
                    : "bg-gray-400 cursor-not-allowed"
                } transition-all duration-200`}
              >
                {hasUnsavedChanges && !saveInProgress && (
                  <div
                    className="absolute inset-0 -top-[1px] -bottom-[1px] bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer"
                    style={{
                      background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)",
                      animation: "shimmer 2s infinite",
                    }}
                  />
                )}
                <Save className="w-4 h-4 mr-2 relative z-10" />
                <span className="relative z-10">{saveInProgress ? 'Saving...' : 'Save All Changes'}</span>
              </Button>
            </div>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-4"> {/* 4 tabs: Results, Criteria, Counties, Jobs */}
            <TabsTrigger value="results">Results & Filters</TabsTrigger>
            <TabsTrigger value="criteria">Scoring Criteria</TabsTrigger>
            <TabsTrigger value="counties">Counties</TabsTrigger>
            <TabsTrigger value="jobs">Job Monitor</TabsTrigger>
            {/* <TabsTrigger value="schedule">Schedule</TabsTrigger> */}
          </TabsList>

          {/* Results & Filters Tab */}
          <div className={`${activeTab !== "results" ? "hidden" : ""}`}>
            <ResultsAndFilters 
              onSettingsChange={() => setHasUnsavedChanges(true)}
            />
          </div>

          {/* Scoring Criteria Tab */}
          <div className={`${activeTab !== "criteria" ? "hidden" : ""}`}>
            <ScoringCriteria 
              onSettingsChange={() => setHasUnsavedChanges(true)}
            />
          </div>

          {/* Counties Tab */}
          <div className={`${activeTab !== "counties" ? "hidden" : ""}`}>
            <CountySelection 
              onSettingsChange={() => setHasUnsavedChanges(true)}
            />
          </div>

          {/* Job Monitor Tab */}
          <div className={`${activeTab !== "jobs" ? "hidden" : ""}`}>
            <JobMonitor />
          </div>

          {/* Schedule Tab */}
          <div className={`${activeTab !== "schedule" ? "hidden" : ""}`}>
            <ScheduleSettings 
              onSettingsChange={() => setHasUnsavedChanges(true)}
            />
          </div>
        </Tabs>
      </div>
    </div>
  )
}
