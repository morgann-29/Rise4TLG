import api from './api'

export const navigantService = {
  // ============================================
  // PROJECT
  // ============================================

  async getMyProject() {
    const response = await api.get('/api/navigant/project')
    return response.data
  },

  // ============================================
  // SESSIONS (session du projet, sans session_master)
  // ============================================

  async getSessions(includeDeleted = false) {
    const response = await api.get('/api/navigant/sessions', {
      params: { include_deleted: includeDeleted }
    })
    return response.data
  },

  async getSession(sessionId) {
    const response = await api.get(`/api/navigant/sessions/${sessionId}`)
    return response.data
  },

  async createSession(data) {
    const response = await api.post('/api/navigant/sessions', data)
    return response.data
  },

  async updateSession(sessionId, data) {
    const response = await api.put(`/api/navigant/sessions/${sessionId}`, data)
    return response.data
  },

  async deleteSession(sessionId) {
    await api.delete(`/api/navigant/sessions/${sessionId}`)
  },

  // Session detail (avec session_master, crew, work_leads)
  async getSessionDetail(sessionId) {
    const response = await api.get(`/api/navigant/sessions/${sessionId}/detail`)
    return response.data
  },

  // Session work leads
  async getSessionWorkLeads(sessionId) {
    const response = await api.get(`/api/navigant/sessions/${sessionId}/work-leads`)
    return response.data
  },

  async updateSessionWorkLead(sessionId, workLeadId, status) {
    const response = await api.put(`/api/navigant/sessions/${sessionId}/work-leads/${workLeadId}`, { status })
    return response.data
  },

  // ============================================
  // WORK LEADS (work_lead du projet, sans work_lead_master)
  // ============================================

  async getWorkLeads(includeDeleted = false, includeArchived = false) {
    const response = await api.get('/api/navigant/work-leads', {
      params: {
        include_deleted: includeDeleted,
        include_archived: includeArchived
      }
    })
    return response.data
  },

  async getWorkLead(workLeadId) {
    const response = await api.get(`/api/navigant/work-leads/${workLeadId}`)
    return response.data
  },

  async createWorkLead(data) {
    const response = await api.post('/api/navigant/work-leads', data)
    return response.data
  },

  async updateWorkLead(workLeadId, data) {
    const response = await api.put(`/api/navigant/work-leads/${workLeadId}`, data)
    return response.data
  },

  async deleteWorkLead(workLeadId) {
    await api.delete(`/api/navigant/work-leads/${workLeadId}`)
  },

  async archiveWorkLead(workLeadId) {
    await api.post(`/api/navigant/work-leads/${workLeadId}/archive`)
  },

  async unarchiveWorkLead(workLeadId) {
    await api.post(`/api/navigant/work-leads/${workLeadId}/unarchive`)
  },

  async restoreWorkLead(workLeadId) {
    await api.post(`/api/navigant/work-leads/${workLeadId}/restore`)
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