"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Download, Eye, RotateCcw, TestTube, BarChart3 } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { apiClient } from "@/lib/api"

interface ResultsAndFiltersProps {
  onSettingsChange: (hasChanges: boolean) => void
  onSave?: () => Promise<void>
}

interface County {
  id: number
  name: string
  code: string
  enabled: boolean
}

interface CountyWithData {
  name: string
  code: string
  project_count: number
}

interface CategoryData {
  count: number
  total_value: number
  avg_value: number
  last_updated?: string
}

interface Project {
  [key: string]: any
  'Estimated Amt'?: string
  'Received Date'?: string
  'City'?: string
}

interface CategoryResponse {
  category: string
  count: number
  projects: Project[]
}

interface StatsData {
  total_projects: number
  total_value: number
  avg_value: number
  last_updated?: string
}

export default function ResultsAndFilters({ onSettingsChange, onSave }: ResultsAndFiltersProps) {
  const [customFilters, setCustomFilters] = useState({
    minAmount: "",
    receivedAfter: "",
    county: "All Counties",
  })
  const [categoryData, setCategoryData] = useState<Record<string, CategoryData>>({})
  const [statsData, setStatsData] = useState<StatsData>({ total_projects: 0, total_value: 0, avg_value: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [counties, setCounties] = useState<County[]>([])
  const [countiesWithData, setCountiesWithData] = useState<CountyWithData[]>([])
  const [customExportLoading, setCustomExportLoading] = useState(false)

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        setError(null)
        
        const [categories, countiesData, countiesWithDataResponse, stats] = await Promise.all([
          apiClient.getCategories(),
          apiClient.getCounties(),
          apiClient.getCountiesWithData(),
          apiClient.getStats()
        ])
        
        setCategoryData(categories as Record<string, CategoryData>)
        setCounties(countiesData as County[])
        setCountiesWithData(countiesWithDataResponse as CountyWithData[])
        
        // Calculate total and average values from all categories
        const categoryEntries = Object.values(categories as Record<string, CategoryData>)
        const totalValue = categoryEntries.reduce((sum, cat) => sum + (cat.total_value || 0), 0)
        const totalCount = categoryEntries.reduce((sum, cat) => sum + (cat.count || 0), 0)
        const avgValue = totalCount > 0 ? totalValue / totalCount : 0
        
        setStatsData({
          total_projects: (stats as any).total_projects || 0,
          total_value: totalValue,
          avg_value: avgValue,
          last_updated: (stats as any).last_updated
        })
      } catch (err) {
        console.error('Failed to fetch data:', err)
        setError('Failed to load data. Please check if the backend server is running.')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  const handleSaveChanges = async () => {
    try {
      // Refresh category data to see updated counts
      const updatedCategories = await apiClient.getCategories()
      setCategoryData(updatedCategories as Record<string, CategoryData>)
      
      onSettingsChange(false)  // Clear the unsaved changes indicator
    } catch (error) {
      console.error('Error refreshing data:', error)
      throw error;
    }
  }

  // Register our save function with parent component
  useEffect(() => {
    (window as any).resultsAndFiltersSave = handleSaveChanges;
  }, [handleSaveChanges])

  const handleCustomDownload = async () => {
    setCustomExportLoading(true)
    try {
      console.log("Downloading with custom filters:", customFilters)
      
      // Get all projects from all categories for filtering (including ignored)
      const [strongLeads, weakLeads, watchlist, ignored] = await Promise.all([
        apiClient.getCategoryProjects('strongLeads', 10000),
        apiClient.getCategoryProjects('weakLeads', 10000),
        apiClient.getCategoryProjects('watchlist', 10000),
        apiClient.getCategoryProjects('ignored', 10000)
      ]) as CategoryResponse[]
      
      const allProjects: Project[] = [
        ...strongLeads.projects,
        ...weakLeads.projects,
        ...watchlist.projects,
        ...ignored.projects
      ]
      
      // Apply custom filters
      const filteredProjects = allProjects.filter(project => {
        // Amount filter
        if (customFilters.minAmount) {
          const projectAmount = parseFloat(String(project['Estimated Amt'] || '0').replace(/[$,]/g, ''))
          const minAmount = parseFloat(customFilters.minAmount)
          if (projectAmount < minAmount) return false
        }
        
        // Received date filter
        if (customFilters.receivedAfter) {
          const receivedDate = new Date(project['Received Date'] || '')
          const filterDate = new Date(customFilters.receivedAfter)
          if (receivedDate < filterDate) return false
        }
        
        // County filter
        if (customFilters.county && customFilters.county !== "All Counties") {
          // Find the selected county's code
          const selectedCounty = countiesWithData.find(c => c.name === customFilters.county)
          if (selectedCounty && project['county_id'] !== selectedCounty.code) return false
        }
        
        return true
      })
      
      if (filteredProjects.length === 0) {
        alert('No projects found matching your custom filters')
        return
      }
      
      downloadProjectsAsCSV(filteredProjects, 'custom_export.csv')
      
    } catch (error) {
      console.error('Error with custom download:', error)
      alert('Failed to generate custom export. Please try again.')
    } finally {
      setCustomExportLoading(false)
    }
  }

  const downloadProjectsAsCSV = (projects: Project[], filename: string) => {
    if (projects.length === 0) return
    
    // Get all unique keys from all projects to create comprehensive headers
    const allKeys = new Set<string>()
    projects.forEach(project => {
      Object.keys(project).forEach(key => allKeys.add(key))
    })
    
    // Filter out columns that are completely empty or only contain empty strings
    const keysWithData = Array.from(allKeys).filter(key => {
      return projects.some(project => {
        const value = project[key]
        return value !== null && value !== undefined && value !== '' && String(value).trim() !== ''
      })
    })
    
    // Order the headers based on the sample CSV structure
    const orderedHeaders = [
      '# Of Incr', 'Address', 'Adj Est.Amt#1', 'Adj Est.Amt#2', 'Adj Est.Date#1', 'Adj Est.Date#2',
      'Application #', 'Approval Ext. Date', 'Approved Date', 'Auto Fire Detection', 'City',
      "Client's Notes", 'Climate Zone', 'Closed Date', 'Complete Submittal Received Date',
      'Construction Change Document Amt', 'Contracted Amt', 'EPR Approved Date', 'Energy Efficiency',
      'Energy Notes', 'Estimated Amt', 'File #', 'HPI', 'HPI Hours', 'HPI Points', 'Included In Plan',
      'OPSC #', 'Office ID', 'PTN #', 'Project Class', 'Project Name', 'Project Scope', 'Project Type',
      "Project's Sq.footage", 'Received Date', 'Required', 'Required review services', 'SB 575',
      'Special Type', 'Special review type', 'Sprinkler System', 'Zip'
    ]
    
    // Add any remaining keys that weren't in the ordered list, but only if they have data
    const remainingKeys = keysWithData.filter(key => !orderedHeaders.includes(key))
    const headers = [...orderedHeaders.filter(header => keysWithData.includes(header)), ...remainingKeys]
    
    // Create CSV content
    const csvContent = [
      headers.join(','),
      ...projects.map(project => 
        headers.map(header => {
          const value = project[header] || ''
          // Escape commas and quotes in CSV
          if (typeof value === 'string' && (value.includes(',') || value.includes('"') || value.includes('\n'))) {
            return `"${value.replace(/"/g, '""')}"`
          }
          return value
        }).join(',')
      )
    ].join('\n')
    
    // Create and download file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob)
      link.setAttribute('href', url)
      link.setAttribute('download', filename)
      link.style.visibility = 'hidden'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    }
  }

  const getCategoryColor = (category: string) => {
    switch (category) {
      case "strongLeads":
        return "bg-green-500"
      case "weakLeads":
        return "bg-yellow-500"
      case "watchlist":
        return "bg-blue-500"
      case "ignored":
        return "bg-gray-500"
      default:
        return "bg-gray-400"
    }
  }

  const getCategoryName = (category: string) => {
    switch (category) {
      case "strongLeads":
        return "Strong Leads"
      case "weakLeads":
        return "Weak Leads"
      case "watchlist":
        return "Watchlist"
      case "ignored":
        return "Ignored"
      default:
        return category
    }
  }

  const handleDownload = async (category: string) => {
    try {
      console.log(`Downloading ${category} projects...`)
      const response = await apiClient.getCategoryProjects(category, 10000) as CategoryResponse
      const projects = response.projects
      
      if (projects.length === 0) {
        alert(`No projects found in ${getCategoryName(category)} category`)
        return
      }
      
      downloadProjectsAsCSV(projects, `${category}_projects.csv`)
    } catch (error) {
      console.error('Error downloading projects:', error)
      alert('Failed to download projects. Please try again.')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading results...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center p-8">
        <div className="text-red-500 text-xl mb-4">⚠ Error</div>
        <p className="text-gray-600 mb-4">{error}</p>
        <Button onClick={() => window.location.reload()}>
          Retry
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Project Categories</CardTitle>
          <CardDescription>
            Projects are automatically categorized based on your scoring criteria. Download data for each category
            or create custom exports.
          </CardDescription>
        </CardHeader>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Category Boxes */}
        {["strongLeads", "weakLeads", "watchlist"].map((category) => {
          const data = categoryData[category] || { count: 0, total_value: 0, avg_value: 0 }
          return (
            <Card key={category}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div className="flex items-center space-x-2">
                  <div className={`w-3 h-3 rounded-full ${getCategoryColor(category)}`}></div>
                  <CardTitle className="text-sm font-medium">{getCategoryName(category)}</CardTitle>
                </div>
                <Badge variant="outline">{data.count || 0}</Badge>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{(data.count || 0).toLocaleString()}</div>
                <p className="text-xs text-muted-foreground mb-1">
                  Total value: ${(data.total_value || 0).toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground mb-3">
                  Average value: ${(data.avg_value || 0).toLocaleString()}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => handleDownload(category)}
                >
                  <Download className="w-3 h-3 mr-1" />
                  Download CSV
                </Button>
              </CardContent>
            </Card>
          )
        })}

        {/* All Projects Box */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div className="flex items-center space-x-2">
              <BarChart3 className="w-4 h-4 text-muted-foreground" />
              <CardTitle className="text-sm font-medium">All Projects</CardTitle>
            </div>
            <Badge variant="outline">{statsData.total_projects.toLocaleString()}</Badge>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statsData.total_projects.toLocaleString()}</div>
            <br></br>
            <br></br>
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => handleDownload('all')}
            >
              <Download className="w-3 h-3 mr-1" />
              Download CSV
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Custom Export Section */}
      <Card>
        <CardHeader>
          <CardTitle>Custom Export</CardTitle>
          <CardDescription>
            Create a custom export with your own filtering criteria
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <Label className="mb-2" htmlFor="custom-amount">Minimum Amount ($)</Label>
              <Input
                id="custom-amount"
                type="number"
                value={customFilters.minAmount}
                onChange={(e) =>
                  setCustomFilters((prev) => ({ ...prev, minAmount: e.target.value }))
                }
                placeholder="Enter minimum amount"
              />
            </div>
            <div>
              <Label className="mb-2" htmlFor="custom-received">Received After</Label>
              <Input
                id="custom-received"
                type="date"
                value={customFilters.receivedAfter}
                onChange={(e) =>
                  setCustomFilters((prev) => ({ ...prev, receivedAfter: e.target.value }))
                }
              />
            </div>
            <div>
              <Label className="mb-2" htmlFor="custom-county">County</Label>
              <Select
                value={customFilters.county}
                onValueChange={(value) =>
                  setCustomFilters((prev) => ({ ...prev, county: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select county" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="All Counties">All Counties</SelectItem>
                  {countiesWithData.map((county, index) => (
                    <SelectItem key={index} value={county.name}>
                      {county.name} ({county.project_count} projects)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex justify-end">
            <Button 
              onClick={handleCustomDownload}
              disabled={customExportLoading}
              className="flex items-center"
            >
              <Download className="w-4 h-4 mr-2" />
              {customExportLoading ? 'Generating...' : 'Download Custom Export'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
