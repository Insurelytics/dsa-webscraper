"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Mail, RefreshCw } from "lucide-react"
import { apiClient } from "@/lib/api"

// Email notification settings
const defaultEmailSettings = {
  emails: "",
  frequency: "weekly",
  leadType: "strong", // "strong" or "both"
  weeklyDay: "monday",
  monthlyDay: 1,
}

interface EmailScheduleProps {
  onSettingsChange: (hasChanges: boolean) => void
}

export default function EmailSchedule({ onSettingsChange }: EmailScheduleProps) {
  const [emailSettings, setEmailSettings] = useState(defaultEmailSettings)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [originalSettings, setOriginalSettings] = useState(defaultEmailSettings)

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        setLoading(true)
        setError(null)
        const settings = await apiClient.getEmailSettings() as { emails: string; frequency: string; leadType: string; weeklyDay: string; monthlyDay: number; }
        setEmailSettings(settings)
        setOriginalSettings(settings)
      } catch (err) {
        console.error('Failed to fetch email settings:', err)
        setError('Failed to load email settings. Please check if the backend server is running.')
      } finally {
        setLoading(false)
      }
    }

    fetchSettings()
  }, [])

  const updateEmailSetting = (field: string, value: any) => {
    setEmailSettings((prev) => ({
      ...prev,
      [field]: value,
    }))
    onSettingsChange(true)
  }

  const handleSaveChanges = async () => {
    try {
      console.log('Saving email settings:', emailSettings)
      await apiClient.updateEmailSettings(emailSettings)
      
      // Update original settings to new values
      setOriginalSettings(emailSettings)
      onSettingsChange(false)  // Clear the unsaved changes indicator
      
      alert('Email settings updated successfully!')
    } catch (error) {
      console.error('Error saving email settings:', error)
      alert('Failed to save email settings. Please try again.')
      throw error; // Re-throw so parent knows save failed
    }
  }

  // Register our save function with parent component
  useEffect(() => {
    (window as any).emailScheduleSave = handleSaveChanges;
  }, [handleSaveChanges])

  const isEnabled = emailSettings.emails.trim().length > 0

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
              <span className="ml-2">Loading email settings...</span>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardContent className="p-6">
            <div className="text-red-500 text-center">
              <p>{error}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }



  return (
    <div className="max-w-2xl mx-auto">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center space-x-2">
                <Mail className="h-5 w-5" />
                <span>Email Lead Notifications</span>
              </CardTitle>
              <CardDescription>
                Receive automated email updates with new project leads from your selected counties
              </CardDescription>
            </div>
            <Badge variant={isEnabled ? "default" : "secondary"}>
              {isEnabled ? "Enabled" : "Disabled"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">


          <div className="space-y-2">
            <Label htmlFor="email-addresses">Email Addresses</Label>
            <Input
              id="email-addresses"
              type="text"
              placeholder="email1@example.com, email2@example.com"
              value={emailSettings.emails}
              onChange={(e) => updateEmailSetting("emails", e.target.value)}
            />
            <p className="text-xs text-gray-500">
              Enter multiple email addresses separated by commas
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="email-frequency">Frequency</Label>
              <Select
                value={emailSettings.frequency}
                onValueChange={(value) => updateEmailSetting("frequency", value)}
                disabled={!isEnabled}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email-leadtype">Lead Type</Label>
              <Select
                value={emailSettings.leadType}
                onValueChange={(value) => updateEmailSetting("leadType", value)}
                disabled={!isEnabled}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="strong">Strong Leads Only</SelectItem>
                  <SelectItem value="both">Strong and Weak Leads</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Day selection based on frequency */}
          {emailSettings.frequency === "weekly" && (
            <div className="space-y-2">
              <Label htmlFor="weekly-day">Day of Week</Label>
              <Select
                value={emailSettings.weeklyDay}
                onValueChange={(value) => updateEmailSetting("weeklyDay", value)}
                disabled={!isEnabled}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monday">Monday</SelectItem>
                  <SelectItem value="tuesday">Tuesday</SelectItem>
                  <SelectItem value="wednesday">Wednesday</SelectItem>
                  <SelectItem value="thursday">Thursday</SelectItem>
                  <SelectItem value="friday">Friday</SelectItem>
                  <SelectItem value="saturday">Saturday</SelectItem>
                  <SelectItem value="sunday">Sunday</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {emailSettings.frequency === "monthly" && (
            <div className="space-y-2">
              <Label htmlFor="monthly-day">Day of Month</Label>
              <Select
                value={emailSettings.monthlyDay.toString()}
                onValueChange={(value) => updateEmailSetting("monthlyDay", parseInt(value))}
                disabled={!isEnabled}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
                    <SelectItem key={day} value={day.toString()}>
                      {day === 1 ? "1st" : day === 2 ? "2nd" : day === 3 ? "3rd" : `${day}th`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500">
                If the selected day doesn't exist in a month (e.g., 31st in February), the email will be sent on the last day of that month.
              </p>
            </div>
          )}

          <div className="p-4 bg-blue-50 rounded-lg text-sm text-blue-700">
            <div className="flex items-start space-x-2 mb-2">
              <RefreshCw className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium mb-1">Automatic Data Refresh</p>
                <p>
                  The system will automatically re-scrape project data before sending each email to ensure 
                  you receive the most up-to-date information available.
                </p>
              </div>
            </div>
          </div>

          <div className="p-4 bg-green-50 rounded-lg text-sm text-green-700">
            <p className="font-medium mb-1">Email Schedule Summary:</p>
            <p>
              This will send the specified email addresses any new{" "}
              <span className="font-medium">
                {emailSettings.leadType === "strong" ? "strong leads" : "strong and weak leads"}
              </span>{" "}
              {emailSettings.frequency === "daily" ? "every day" : 
               emailSettings.frequency === "weekly" ? 
                 `every ${emailSettings.weeklyDay.charAt(0).toUpperCase() + emailSettings.weeklyDay.slice(1)}` : 
                 `on the ${emailSettings.monthlyDay === 1 ? "1st" : 
                           emailSettings.monthlyDay === 2 ? "2nd" : 
                           emailSettings.monthlyDay === 3 ? "3rd" : 
                           `${emailSettings.monthlyDay}th`} of each month`}
              .
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

