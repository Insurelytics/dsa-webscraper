const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

class ApiClient {
  private baseURL: string;

  constructor() {
    this.baseURL = API_BASE_URL;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseURL}${endpoint}`;
    
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  // Stats and categories
  async getStats() {
    return this.request('/api/stats');
  }

  async getCategories() {
    return this.request('/api/categories');
  }

  async getCategoryProjects(category: string, limit: number = 100) {
    return this.request(`/api/categories/${category}/projects?limit=${limit}`);
  }

  async getCountiesWithData() {
    return this.request('/api/counties/with-data');
  }

  // Counties
  async getCounties() {
    return this.request('/api/counties');
  }

  async getEnabledCounties() {
    return this.request('/api/counties/enabled');
  }

  async getCounty(countyCode: string) {
    return this.request(`/api/counties/${countyCode}`);
  }

  async updateCountyStatus(countyId: number, enabled: boolean) {
    return this.request(`/api/counties/${countyId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ enabled }),
    });
  }

  async scrapeCounty(countyCode: string) {
    return this.request(`/counties/${countyCode}/scrape`, {
      method: 'POST',
    });
  }

  // Scraping jobs
  async startScraping(countyId: string) {
    return this.request('/start-scraping', {
      method: 'POST',
      body: JSON.stringify({ county_id: countyId }),
    });
  }

  async stopScraping() {
    return this.request('/stop-scraping', {
      method: 'POST',
    });
  }

  async getJobStatus(jobId: number) {
    return this.request(`/status/${jobId}`);
  }

  async getAllJobs(limit: number = 50) {
    return this.request(`/jobs?limit=${limit}`);
  }

  async stopJob(jobId: number) {
    return this.request(`/jobs/${jobId}/stop`, {
      method: 'POST',
    });
  }

  async retryJob(jobId: number) {
    return this.request(`/jobs/${jobId}/retry`, {
      method: 'POST',
    });
  }

  // Project management
  async recategorizeProjects() {
    return this.request('/api/recategorize', {
      method: 'POST',
    });
  }

  // Scoring criteria management
  async getCriteria() {
    return this.request('/api/criteria');
  }

  async updateCriteria(criteria: any) {
    return this.request('/api/criteria', {
      method: 'PUT',
      body: JSON.stringify({ criteria }),
    });
  }

  async applyCriteria(criteria: any) {
    return this.request('/api/criteria/apply', {
      method: 'POST',
      body: JSON.stringify({ criteria }),
    });
  }
}

export const apiClient = new ApiClient();
export default apiClient; 