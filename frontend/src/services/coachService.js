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

  async getGroupBasic(groupId) {
    const response = await api.get(`/api/coach/groups/${groupId}/basic`)
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

  async getGroupWorkLeadSessions(groupId, workLeadId, offset = 0, limit = 10) {
    const response = await api.get(`/api/coach/groups/${groupId}/work-leads/${workLeadId}/sessions`, {
      params: { offset, limit }
    })
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

  async restoreGroupWorkLead(groupId, workLeadId) {
    await api.post(`/api/coach/groups/${groupId}/work-leads/${workLeadId}/restore`)
  },

  // ============================================
  // PROJECTS
  // ============================================

  async getGroupProjects(groupId) {
    const response = await api.get(`/api/coach/groups/${groupId}/projects`)
    return response.data
  },

  async getProjectDetail(groupId, projectId) {
    const response = await api.get(`/api/coach/groups/${groupId}/projects/${projectId}`)
    return response.data
  },

  // ============================================
  // PROJECT SESSIONS (sessions du projet)
  // ============================================

  async getProjectSessions(groupId, projectId, includeDeleted = false) {
    const response = await api.get(`/api/coach/groups/${groupId}/projects/${projectId}/sessions`, {
      params: { include_deleted: includeDeleted }
    })
    return response.data
  },

  async createProjectSession(groupId, projectId, data) {
    const response = await api.post(`/api/coach/groups/${groupId}/projects/${projectId}/sessions`, data)
    return response.data
  },

  async updateProjectSession(groupId, projectId, sessionId, data) {
    const response = await api.put(`/api/coach/groups/${groupId}/projects/${projectId}/sessions/${sessionId}`, data)
    return response.data
  },

  async deleteProjectSession(groupId, projectId, sessionId) {
    await api.delete(`/api/coach/groups/${groupId}/projects/${projectId}/sessions/${sessionId}`)
  },

  // Session detail (avec session_master, crew, work_leads)
  async getProjectSessionDetail(groupId, projectId, sessionId) {
    const response = await api.get(`/api/coach/groups/${groupId}/projects/${projectId}/sessions/${sessionId}/detail`)
    return response.data
  },

  // Session work leads
  async getProjectSessionWorkLeads(groupId, projectId, sessionId) {
    const response = await api.get(`/api/coach/groups/${groupId}/projects/${projectId}/sessions/${sessionId}/work-leads`)
    return response.data
  },

  async updateProjectSessionWorkLead(groupId, projectId, sessionId, workLeadId, status) {
    const response = await api.put(`/api/coach/groups/${groupId}/projects/${projectId}/sessions/${sessionId}/work-leads/${workLeadId}`, { status })
    return response.data
  },

  // ============================================
  // PROJECT WORK LEADS (axes de travail du projet)
  // ============================================

  async getProjectWorkLeads(groupId, projectId, includeDeleted = false, includeArchived = false) {
    const response = await api.get(`/api/coach/groups/${groupId}/projects/${projectId}/work-leads`, {
      params: {
        include_deleted: includeDeleted,
        include_archived: includeArchived
      }
    })
    return response.data
  },

  async getProjectWorkLead(groupId, projectId, workLeadId) {
    const response = await api.get(`/api/coach/groups/${groupId}/projects/${projectId}/work-leads/${workLeadId}`)
    return response.data
  },

  async getProjectWorkLeadSessions(groupId, projectId, workLeadId, offset = 0, limit = 10) {
    const response = await api.get(`/api/coach/groups/${groupId}/projects/${projectId}/work-leads/${workLeadId}/sessions`, {
      params: { offset, limit }
    })
    return response.data
  },

  async createProjectWorkLead(groupId, projectId, data) {
    const response = await api.post(`/api/coach/groups/${groupId}/projects/${projectId}/work-leads`, data)
    return response.data
  },

  async updateProjectWorkLead(groupId, projectId, workLeadId, data) {
    const response = await api.put(`/api/coach/groups/${groupId}/projects/${projectId}/work-leads/${workLeadId}`, data)
    return response.data
  },

  async deleteProjectWorkLead(groupId, projectId, workLeadId) {
    await api.delete(`/api/coach/groups/${groupId}/projects/${projectId}/work-leads/${workLeadId}`)
  },

  async archiveProjectWorkLead(groupId, projectId, workLeadId) {
    await api.post(`/api/coach/groups/${groupId}/projects/${projectId}/work-leads/${workLeadId}/archive`)
  },

  async unarchiveProjectWorkLead(groupId, projectId, workLeadId) {
    await api.post(`/api/coach/groups/${groupId}/projects/${projectId}/work-leads/${workLeadId}/unarchive`)
  },

  async restoreProjectWorkLead(groupId, projectId, workLeadId) {
    await api.post(`/api/coach/groups/${groupId}/projects/${projectId}/work-leads/${workLeadId}/restore`)
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
  },

  // ============================================
  // WORK LEAD MODELS (templates pour import)
  // ============================================

  async getWorkLeadModels() {
    const response = await api.get('/api/coach/work-lead-models')
    return response.data
  },

  async importWorkLeadModel(groupId, modelId) {
    const response = await api.post(`/api/coach/groups/${groupId}/work-leads/import`, {
      model_id: modelId
    })
    return response.data
  },

  // ============================================
  // GROUP COACHES
  // ============================================

  async getGroupCoaches(groupId) {
    const response = await api.get(`/api/coach/groups/${groupId}/coaches`)
    return response.data
  },

  // ============================================
  // SESSION PARTICIPANTS & DATES
  // ============================================

  async updateSessionParticipants(groupId, sessionId, projectIds, coachId) {
    const response = await api.put(`/api/coach/groups/${groupId}/sessions/${sessionId}/participants`, {
      project_ids: projectIds,
      coach_id: coachId
    })
    return response.data
  },

  async updateSessionDates(groupId, sessionId, dateStart, dateEnd) {
    const response = await api.put(`/api/coach/groups/${groupId}/sessions/${sessionId}/dates`, {
      date_start: dateStart,
      date_end: dateEnd
    })
    return response.data
  },

  // ============================================
  // SESSION WORK LEAD MASTERS (thematiques)
  // ============================================

  async getSessionWorkLeadMasters(groupId, sessionId) {
    const response = await api.get(`/api/coach/groups/${groupId}/sessions/${sessionId}/work-lead-masters`)
    return response.data
  },

  async updateSessionWorkLeadMaster(groupId, sessionId, workLeadMasterId, status) {
    const response = await api.put(`/api/coach/groups/${groupId}/sessions/${sessionId}/work-lead-masters`, {
      work_lead_master_id: workLeadMasterId,
      status: status // null = supprimer, sinon TODO/WORKING/DANGER/OK
    })
    return response.data
  },

  // ============================================
  // PERIODS (period_master du groupe)
  // ============================================

  async getGroupPeriods(groupId, includeDeleted = false) {
    const response = await api.get(`/api/coach/groups/${groupId}/periods`, {
      params: { include_deleted: includeDeleted }
    })
    return response.data
  },

  async getGroupPeriod(groupId, periodId) {
    const response = await api.get(`/api/coach/groups/${groupId}/periods/${periodId}`)
    return response.data
  },

  async createGroupPeriod(groupId, data) {
    const response = await api.post(`/api/coach/groups/${groupId}/periods`, data)
    return response.data
  },

  async updateGroupPeriod(groupId, periodId, data) {
    const response = await api.put(`/api/coach/groups/${groupId}/periods/${periodId}`, data)
    return response.data
  },

  async deleteGroupPeriod(groupId, periodId) {
    await api.delete(`/api/coach/groups/${groupId}/periods/${periodId}`)
  },

  async restoreGroupPeriod(groupId, periodId) {
    await api.post(`/api/coach/groups/${groupId}/periods/${periodId}/restore`)
  },

  async getGroupPeriodSessionMasters(groupId, periodId) {
    const response = await api.get(`/api/coach/groups/${groupId}/periods/${periodId}/session-masters`)
    return response.data
  },

  async updatePeriodParticipants(groupId, periodId, projectIds) {
    const response = await api.put(`/api/coach/groups/${groupId}/periods/${periodId}/participants`, {
      project_ids: projectIds
    })
    return response.data
  },

  // ============================================
  // PROJECT PERIODS (period du projet)
  // ============================================

  async getProjectPeriods(groupId, projectId, includeDeleted = false) {
    const response = await api.get(`/api/coach/groups/${groupId}/projects/${projectId}/periods`, {
      params: { include_deleted: includeDeleted }
    })
    return response.data
  },

  async getProjectPeriod(groupId, projectId, periodId) {
    const response = await api.get(`/api/coach/groups/${groupId}/projects/${projectId}/periods/${periodId}`)
    return response.data
  },

  async createProjectPeriod(groupId, projectId, data) {
    const response = await api.post(`/api/coach/groups/${groupId}/projects/${projectId}/periods`, data)
    return response.data
  },

  async updateProjectPeriod(groupId, projectId, periodId, data) {
    const response = await api.put(`/api/coach/groups/${groupId}/projects/${projectId}/periods/${periodId}`, data)
    return response.data
  },

  async deleteProjectPeriod(groupId, projectId, periodId) {
    await api.delete(`/api/coach/groups/${groupId}/projects/${projectId}/periods/${periodId}`)
  },

  async restoreProjectPeriod(groupId, projectId, periodId) {
    await api.post(`/api/coach/groups/${groupId}/projects/${projectId}/periods/${periodId}/restore`)
  },

  async getProjectPeriodSessions(groupId, projectId, periodId) {
    const response = await api.get(`/api/coach/groups/${groupId}/projects/${projectId}/periods/${periodId}/sessions`)
    return response.data
  }
}
