import api from './api'

export const navigantService = {
  // ============================================
  // PROJECTS
  // ============================================

  async getMyProjects() {
    const response = await api.get('/api/navigant/projects')
    return response.data
  },

  // Deprecated: utiliser getMyProjects()
  async getMyProject() {
    const response = await api.get('/api/navigant/project')
    return response.data
  },

  // ============================================
  // SESSIONS (avec projectId)
  // ============================================

  async getSessions(projectId, includeDeleted = false) {
    const response = await api.get(`/api/navigant/projects/${projectId}/sessions`, {
      params: { include_deleted: includeDeleted }
    })
    return response.data
  },

  async getSession(projectId, sessionId) {
    const response = await api.get(`/api/navigant/projects/${projectId}/sessions/${sessionId}`)
    return response.data
  },

  async createSession(projectId, data) {
    const response = await api.post(`/api/navigant/projects/${projectId}/sessions`, data)
    return response.data
  },

  async updateSession(projectId, sessionId, data) {
    const response = await api.put(`/api/navigant/projects/${projectId}/sessions/${sessionId}`, data)
    return response.data
  },

  async deleteSession(projectId, sessionId) {
    await api.delete(`/api/navigant/projects/${projectId}/sessions/${sessionId}`)
  },

  // Session detail (avec session_master, crew, work_leads)
  async getSessionDetail(projectId, sessionId) {
    const response = await api.get(`/api/navigant/projects/${projectId}/sessions/${sessionId}/detail`)
    return response.data
  },

  // Session work leads
  async getSessionWorkLeads(projectId, sessionId) {
    const response = await api.get(`/api/navigant/projects/${projectId}/sessions/${sessionId}/work-leads`)
    return response.data
  },

  async updateSessionWorkLead(projectId, sessionId, workLeadId, status) {
    const response = await api.put(`/api/navigant/projects/${projectId}/sessions/${sessionId}/work-leads/${workLeadId}`, { status })
    return response.data
  },

  // ============================================
  // WORK LEADS (avec projectId)
  // ============================================

  async getWorkLeads(projectId, includeDeleted = false, includeArchived = false) {
    const response = await api.get(`/api/navigant/projects/${projectId}/work-leads`, {
      params: {
        include_deleted: includeDeleted,
        include_archived: includeArchived
      }
    })
    return response.data
  },

  async getWorkLead(projectId, workLeadId) {
    const response = await api.get(`/api/navigant/projects/${projectId}/work-leads/${workLeadId}`)
    return response.data
  },

  async getWorkLeadSessions(projectId, workLeadId, offset = 0, limit = 10) {
    const response = await api.get(`/api/navigant/projects/${projectId}/work-leads/${workLeadId}/sessions`, {
      params: { offset, limit }
    })
    return response.data
  },

  async createWorkLead(projectId, data) {
    const response = await api.post(`/api/navigant/projects/${projectId}/work-leads`, data)
    return response.data
  },

  async updateWorkLead(projectId, workLeadId, data) {
    const response = await api.put(`/api/navigant/projects/${projectId}/work-leads/${workLeadId}`, data)
    return response.data
  },

  async deleteWorkLead(projectId, workLeadId) {
    await api.delete(`/api/navigant/projects/${projectId}/work-leads/${workLeadId}`)
  },

  async archiveWorkLead(projectId, workLeadId) {
    await api.post(`/api/navigant/projects/${projectId}/work-leads/${workLeadId}/archive`)
  },

  async unarchiveWorkLead(projectId, workLeadId) {
    await api.post(`/api/navigant/projects/${projectId}/work-leads/${workLeadId}/unarchive`)
  },

  async restoreWorkLead(projectId, workLeadId) {
    await api.post(`/api/navigant/projects/${projectId}/work-leads/${workLeadId}/restore`)
  },

  // ============================================
  // PERIODS
  // ============================================

  async getPeriods(projectId, includeDeleted = false) {
    const response = await api.get(`/api/navigant/projects/${projectId}/periods`, {
      params: { include_deleted: includeDeleted }
    })
    return response.data
  },

  async getPeriod(projectId, periodId) {
    const response = await api.get(`/api/navigant/projects/${projectId}/periods/${periodId}`)
    return response.data
  },

  async getPeriodSessions(projectId, periodId) {
    const response = await api.get(`/api/navigant/projects/${projectId}/periods/${periodId}/sessions`)
    return response.data
  },

  async createPeriod(projectId, data) {
    const response = await api.post(`/api/navigant/projects/${projectId}/periods`, data)
    return response.data
  },

  async updatePeriod(projectId, periodId, data) {
    const response = await api.put(`/api/navigant/projects/${projectId}/periods/${periodId}`, data)
    return response.data
  },

  async deletePeriod(projectId, periodId) {
    await api.delete(`/api/navigant/projects/${projectId}/periods/${periodId}`)
  },

  async restorePeriod(projectId, periodId) {
    await api.post(`/api/navigant/projects/${projectId}/periods/${periodId}/restore`)
  },

  // ============================================
  // DROPDOWNS
  // ============================================

  async getTypeSeances() {
    const response = await api.get('/api/navigant/type-seances')
    return response.data
  },

  async getWorkLeadTypes() {
    const response = await api.get('/api/navigant/work-lead-types')
    return response.data
  }
}
