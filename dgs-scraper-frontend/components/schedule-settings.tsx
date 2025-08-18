"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Mail, RefreshCw } from "lucide-react"

// Email notification settings
const defaultEmailSettings = {
  emails: "",
  frequency: "weekly",
  leadType: "strong", // "strong" or "both"
}

interface EmailScheduleProps {
  onSettingsChange: (hasChanges: boolean) => void
}

export default function EmailSchedule({ onSettingsChange }: EmailScheduleProps) {
  const [emailSettings, setEmailSettings] = useState(defaultEmailSettings)

  const updateEmailSetting = (field: string, value: any) => {
    setEmailSettings((prev) => ({
      ...prev,
      [field]: value,
    }))
    onSettingsChange(true)
  }

  const isEnabled = emailSettings.emails.trim().length > 0



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
              every{" "}
              <span className="font-medium">
                {emailSettings.frequency === "daily" ? "day" : 
                 emailSettings.frequency === "weekly" ? "week" : "month"}
              </span>
              .
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

