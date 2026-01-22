import api from './api'

export const groupService = {
  // ============================================
  // GROUPS
  // ============================================

  async getGroups(includeDeleted = false) {
    const response = await api.get('/api/groups', {
      params: { include_deleted: includeDeleted }
    })
    return response.data
  },

  async getGroup(id) {
    const response = await api.get(`/api/groups/${id}`)
    return response.data
  },

  async createGroup(data) {
    const response = await api.post('/api/groups', data)
    return response.data
  },

  async updateGroup(id, data) {
    const response = await api.put(`/api/groups/${id}`, data)
    return response.data
  },

  async deleteGroup(id) {
    await api.delete(`/api/groups/${id}`)
  },

  async restoreGroup(id) {
    const response = await api.post(`/api/groups/${id}/restore`)
    return response.data
  },

  // ============================================
  // COACHES (pour dropdown)
  // ============================================

  async getCoaches() {
    const response = await api.get('/api/groups/coaches')
    return response.data
  },

  // ============================================
  // GROUP COACHES (pivot group_profile)
  // ============================================

  async addCoachToGroup(groupId, profileId) {
    const response = await api.post(`/api/groups/${groupId}/coaches/${profileId}`)
    return response.data
  },

  async removeCoachFromGroup(groupId, profileId) {
    await api.delete(`/api/groups/${groupId}/coaches/${profileId}`)
  },

  // ============================================
  // GROUP PROJECTS (pivot group_project)
  // ============================================

  async getAvailableProjects(groupId) {
    const response = await api.get(`/api/groups/${groupId}/available-projects`)
    return response.data
  },

  async addProjectToGroup(groupId, projectId) {
    const response = await api.post(`/api/groups/${groupId}/projects/${projectId}`)
    return response.data
  },

  async removeProjectFromGroup(groupId, projectId) {
    await api.delete(`/api/groups/${groupId}/projects/${projectId}`)
  },

  // ============================================
  // TYPE SUPPORT (pour dropdown)
  // ============================================

  async getTypeSupports() {
    const response = await api.get('/api/type-supports')
    return response.data
  }
}
