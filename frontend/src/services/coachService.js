import api from './api'

export const coachService = {
  // ============================================
  // GROUPS
  // ============================================

  async getMyGroups() {
    const response = await api.get('/api/coach/groups')
    return response.data
  },

  async getGroup(groupId) {
    const response = await api.get(`/api/coach/groups/${groupId}`)
    return response.data
  },

  // ============================================
  // SESSIONS (session_master du groupe)
  // ============================================

  async getGroupSessions(groupId, includeDeleted = false) {
    const response = await api.get(`/api/coach/groups/${groupId}/sessions`, {
      params: { include_deleted: includeDeleted }
    })
    return response.data
  },

  async getGroupSession(groupId, sessionId) {
    const response = await api.get(`/api/coach/groups/${groupId}/sessions/${sessionId}`)
    return response.data
  },

  async createGroupSession(groupId, data) {
    const response = await api.post(`/api/coach/groups/${groupId}/sessions`, data)
    return response.data
  },

  async updateGroupSession(groupId, sessionId, data) {
    const response = await api.put(`/api/coach/groups/${groupId}/sessions/${sessionId}`, data)
    return response.data
  },

  async deleteGroupSession(groupId, sessionId) {
    await api.delete(`/api/coach/groups/${groupId}/sessions/${sessionId}`)
  },

  // ============================================
  // WORK LEADS (work_lead_master du groupe)
  // ============================================

  async getGroupWorkLeads(groupId, includeDeleted = false, includeArchived = false) {
    const response = await api.get(`/api/coach/groups/${groupId}/work-leads`, {
      params: {
        include_deleted: includeDeleted,
        include_archived: includeArchived
      }
    })
    return response.data
  },

  async getGroupWorkLead(groupId, workLeadId) {
    const response = await api.get(`/api/coach/groups/${groupId}/work-leads/${workLeadId}`)
    return response.data
  },

  async createGroupWorkLead(groupId, data) {
    const response = await api.post(`/api/coach/groups/${groupId}/work-leads`, data)
    return response.data
  },

  async updateGroupWorkLead(groupId, workLeadId, data) {
    const response = await api.put(`/api/coach/groups/${groupId}/work-leads/${workLeadId}`, data)
    return response.data
  },

  async deleteGroupWorkLead(groupId, workLeadId) {
    await api.delete(`/api/coach/groups/${groupId}/work-leads/${workLeadId}`)
  },

  async archiveGroupWorkLead(groupId, workLeadId) {
    await api.post(`/api/coach/groups/${groupId}/work-leads/${workLeadId}/archive`)
  },

  async unarchiveGroupWorkLead(groupId, workLeadId) {
    await api.post(`/api/coach/groups/${groupId}/work-leads/${workLeadId}/unarchive`)
  },

  // ============================================
  // PROJECTS (lecture seule)
  // ============================================

  async getGroupProjects(groupId) {
    const response = await api.get(`/api/coach/groups/${groupId}/projects`)
    return response.data
  },

  // ============================================
  // DROPDOWNS
  // ============================================

  async getTypeSeances() {
    const response = await api.get('/api/coach/type-seances')
    return response.data
  },

  async getWorkLeadTypes() {
    const response = await api.get('/api/coach/work-lead-types')
    return response.data
  }
}
