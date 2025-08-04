"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Download, Eye, RotateCcw, TestTube } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { apiClient } from "@/lib/api"

// Default criteria for categorization logic
const defaultCriteria = {
  strongLeads: {
    minAmount: 2000000,
    receivedAfter: "2023-01-01",
    approvedAfter: "2023-01-01",
  },
  weakLeads: {
    minAmount: 1000000,
    receivedAfter: "2020-01-01",
    approvedAfter: "2020-01-01",
  },
  watchlist: {
    minAmount: 100000,
    receivedAfter: "2018-01-01",
    approvedAfter: "2018-01-01",
  },
  ignored: {
    minAmount: 0,
    receivedAfter: "2020-01-01",
    approvedAfter: "2020-01-01",
  },
}

interface ResultsAndFiltersProps {
  onSettingsChange: (hasChanges: boolean) => void
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
  'Approved Date'?: string
  'City'?: string
}

interface CategoryResponse {
  category: string
  count: number
  projects: Project[]
}

export default function ResultsAndFilters({ onSettingsChange }: ResultsAndFiltersProps) {
  const [customFilters, setCustomFilters] = useState({
    minAmount: "",
    receivedAfter: "",
    approvedAfter: "",
    county: "All Counties",
  })
  const [criteria, setCriteria] = useState(defaultCriteria)
  const [categoryData, setCategoryData] = useState<Record<string, CategoryData>>({})
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
        
        const [categories, countiesData, countiesWithDataResponse] = await Promise.all([
          apiClient.getCategories(),
          apiClient.getCounties(),
          apiClient.getCountiesWithData()
        ])
        
        setCategoryData(categories as Record<string, CategoryData>)
        setCounties(countiesData as County[])
        setCountiesWithData(countiesWithDataResponse as CountyWithData[])
      } catch (err) {
        console.error('Failed to fetch data:', err)
        setError('Failed to load data. Please check if the backend server is running.')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  const updateCriteria = (category: string, field: string, value: string | number) => {
    setCriteria((prev) => ({
      ...prev,
      [category]: {
        ...prev[category as keyof typeof prev],
        [field]: value,
      },
    }))
    onSettingsChange(true)
  }

  const handleReset = () => {
    setCriteria(defaultCriteria)
    onSettingsChange(false)
  }

  const handleTest = () => {
    console.log("Testing criteria with current data...")
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

  const handleCustomDownload = async () => {
    setCustomExportLoading(true)
    try {
      console.log("Downloading with custom filters:", customFilters)
      
      // Get all projects from all categories for filtering
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
        
        // Approved date filter
        if (customFilters.approvedAfter && project['Approved Date']) {
          const approvedDate = new Date(project['Approved Date'])
          const filterDate = new Date(customFilters.approvedAfter)
          if (approvedDate < filterDate) return false
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

  const renderCriteriaForm = (category: string, data: any) => (
    <Card>
      <CardHeader>
        <div className="flex items-center space-x-3">
          <div className={`w-4 h-4 rounded-full ${getCategoryColor(category)}`}></div>
          <CardTitle>{getCategoryName(category)} Criteria</CardTitle>
        </div>
        <CardDescription>
          Configure the rules for categorizing projects as {getCategoryName(category).toLowerCase()}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label htmlFor={`${category}-amount`}>Minimum Amount ($)</Label>
            <Input
              id={`${category}-amount`}
              type="number"
              value={data.minAmount}
              onChange={(e) => updateCriteria(category, "minAmount", parseInt(e.target.value) || 0)}
              placeholder="1000000"
            />
          </div>
          <div>
            <Label htmlFor={`${category}-received`}>Received After</Label>
            <Input
              id={`${category}-received`}
              type="date"
              value={data.receivedAfter}
              onChange={(e) => updateCriteria(category, "receivedAfter", e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor={`${category}-approved`}>Approved After</Label>
            <Input
              id={`${category}-approved`}
              type="date"
              value={data.approvedAfter}
              onChange={(e) => updateCriteria(category, "approvedAfter", e.target.value)}
            />
          </div>
        </div>

        <div className="p-4 bg-gray-50 rounded-lg">
          <h4 className="font-medium mb-2">Current Logic:</h4>
          <p className="text-sm text-gray-600">
            Projects with estimated amount ≥ ${data.minAmount.toLocaleString()} AND received after {data.receivedAfter}{" "}
            AND approved after {data.approvedAfter} will be categorized as {getCategoryName(category).toLowerCase()}.
          </p>
        </div>
      </CardContent>
    </Card>
  )

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
      <Tabs defaultValue="results" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="results">Project Results</TabsTrigger>
          <TabsTrigger value="scoring">Scoring Criteria</TabsTrigger>
        </TabsList>

        <TabsContent value="results" className="space-y-6">
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
            {["strongLeads", "weakLeads", "watchlist", "ignored"].map((category) => {
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
                    <p className="text-xs text-muted-foreground mb-3">
                      Total value: ${(data.total_value || 0).toLocaleString()}
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
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <Label htmlFor="custom-amount">Minimum Amount ($)</Label>
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
                  <Label htmlFor="custom-received">Received After</Label>
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
                  <Label htmlFor="custom-approved">Approved After</Label>
                  <Input
                    id="custom-approved"
                    type="date"
                    value={customFilters.approvedAfter}
                    onChange={(e) =>
                      setCustomFilters((prev) => ({ ...prev, approvedAfter: e.target.value }))
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="custom-county">County</Label>
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
        </TabsContent>

        <TabsContent value="scoring" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Scoring Criteria</CardTitle>
              <CardDescription>
                Configure how projects are automatically categorized based on amount, dates, and other criteria.
                Changes will be applied to all existing and future projects.
              </CardDescription>
              <div className="flex space-x-2">
                <Button onClick={handleTest} variant="outline" size="sm">
                  <TestTube className="w-4 h-4 mr-2" />
                  Test Criteria
                </Button>
                <Button onClick={handleReset} variant="outline" size="sm">
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Reset to Default
                </Button>
              </div>
            </CardHeader>
          </Card>

          <Tabs defaultValue="strongLeads" className="space-y-6">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="strongLeads" className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-green-500"></div>
                Strong Leads
              </TabsTrigger>
              <TabsTrigger value="weakLeads" className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                Weak Leads
              </TabsTrigger>
              <TabsTrigger value="watchlist" className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                Watchlist
              </TabsTrigger>
              <TabsTrigger value="ignored" className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-gray-500"></div>
                Ignored
              </TabsTrigger>
            </TabsList>

            <TabsContent value="strongLeads">{renderCriteriaForm("strongLeads", criteria.strongLeads)}</TabsContent>
            <TabsContent value="weakLeads">{renderCriteriaForm("weakLeads", criteria.weakLeads)}</TabsContent>
            <TabsContent value="watchlist">{renderCriteriaForm("watchlist", criteria.watchlist)}</TabsContent>
            <TabsContent value="ignored">{renderCriteriaForm("ignored", criteria.ignored)}</TabsContent>
          </Tabs>
        </TabsContent>
      </Tabs>
    </div>
  )
}
