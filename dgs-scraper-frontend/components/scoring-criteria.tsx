"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RotateCcw, TestTube } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Switch } from "@/components/ui/switch"
import { apiClient } from "@/lib/api"

interface ScoringCriteriaProps {
  onSettingsChange: (hasChanges: boolean) => void
}

export default function ScoringCriteria({ onSettingsChange }: ScoringCriteriaProps) {
  const [criteria, setCriteria] = useState<Record<string, any>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [originalCriteria, setOriginalCriteria] = useState<Record<string, any>>({})

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        setError(null)
        
        const criteriaData = await apiClient.getCriteria()
        
        console.log('Loaded criteria from server:', criteriaData)
        
        setCriteria(criteriaData as Record<string, any>)
        setOriginalCriteria(criteriaData as Record<string, any>)
      } catch (err) {
        console.error('Failed to fetch criteria:', err)
        setError('Failed to load criteria. Please check if the backend server is running.')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  const updateCriteria = (category: string, field: string, value: string | number | boolean) => {
    setCriteria((prev) => ({
      ...prev,
      [category]: {
        ...prev[category as keyof typeof prev],
        [field]: value,
      },
    }))
    onSettingsChange(true)
  }

  const handleReset = async () => {
    try {
      console.log('Resetting criteria to:', originalCriteria)
      setCriteria(originalCriteria)
      onSettingsChange(false)
    } catch (error) {
      console.error('Error resetting criteria:', error)
      alert('Failed to reset criteria. Please try again.')
    }
  }

  const handleSaveChanges = async () => {
    try {
      console.log('Saving criteria:', criteria)
      console.log('Saving criteria and applying changes...')
      const response = await apiClient.applyCriteria(criteria) as { success: boolean, message: string, recategorized_count?: number }
      console.log('Criteria applied successfully:', response)
      
      // Update original criteria to new values
      setOriginalCriteria(criteria)
      onSettingsChange(false)  // Clear the unsaved changes indicator
      
      alert(`Criteria updated successfully! ${response.recategorized_count || 0} projects were recategorized.`)
    } catch (error) {
      console.error('Error applying criteria:', error)
      alert('Failed to apply criteria changes. Please try again.')
      throw error; // Re-throw so parent knows save failed
    }
  }

  // Register our save function with parent component
  useEffect(() => {
    (window as any).scoringCriteriaSave = handleSaveChanges;
  }, [handleSaveChanges])

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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor={`${category}-amount`}>Minimum Amount ($)</Label>
            <Input
              id={`${category}-amount`}
              type="number"
              value={data?.minAmount || ''}
              onChange={(e) => {
                const value = e.target.value;
                const numValue = value === '' ? 0 : parseInt(value);
                updateCriteria(category, "minAmount", numValue);
              }}
              placeholder="1000000"
            />
          </div>
          <div>
            <Label htmlFor={`${category}-received`}>Received After</Label>
            <Input
              id={`${category}-received`}
              type="date"
              value={data?.receivedAfter || ''}
              onChange={(e) => updateCriteria(category, "receivedAfter", e.target.value)}
            />
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <Switch
            id={`${category}-no-approved`}
            checked={data?.requireNoApprovedDate || false}
            onCheckedChange={(checked) => updateCriteria(category, "requireNoApprovedDate", checked)}
          />
          <Label htmlFor={`${category}-no-approved`}>Force no approved date (not yet started)</Label>
        </div>

        <div className="p-4 bg-gray-50 rounded-lg">
          <h4 className="font-medium mb-2">Current Logic:</h4>
          <p className="text-sm text-gray-600">
            Projects with estimated amount ≥ ${(data?.minAmount || 0).toLocaleString()} AND received after {data?.receivedAfter || 'any date'}{" "}
            {data?.requireNoApprovedDate ? 'AND no approved date (not yet started) ' : ''}
            will be categorized as {getCategoryName(category).toLowerCase()}.
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
          <p className="mt-2 text-gray-600">Loading scoring criteria...</p>
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
        <TabsList className="grid w-full grid-cols-3">
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
        </TabsList>

        <TabsContent value="strongLeads">{renderCriteriaForm("strongLeads", criteria.strongLeads)}</TabsContent>
        <TabsContent value="weakLeads">{renderCriteriaForm("weakLeads", criteria.weakLeads)}</TabsContent>
        <TabsContent value="watchlist">{renderCriteriaForm("watchlist", criteria.watchlist)}</TabsContent>
      </Tabs>
    </div>
  )
}
