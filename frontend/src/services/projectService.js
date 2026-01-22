import api from './api'

export const projectService = {
  // ============================================
  // PROJECTS
  // ============================================

  async getProjects(includeDeleted = false) {
    const response = await api.get('/api/projects', {
      params: { include_deleted: includeDeleted }
    })
    return response.data
  },

  async getProject(id) {
    const response = await api.get(`/api/projects/${id}`)
    return response.data
  },

  async createProject(data) {
    const response = await api.post('/api/projects', data)
    return response.data
  },

  async updateProject(id, data) {
    const response = await api.put(`/api/projects/${id}`, data)
    return response.data
  },

  async deleteProject(id) {
    await api.delete(`/api/projects/${id}`)
  },

  async restoreProject(id) {
    const response = await api.post(`/api/projects/${id}/restore`)
    return response.data
  },

  // ============================================
  // NAVIGANTS (pour dropdown creation projet)
  // ============================================

  async getNavigants() {
    const response = await api.get('/api/projects/navigants')
    return response.data
  },

  // ============================================
  // TYPE SUPPORT (pour dropdown)
  // ============================================

  async getTypeSupports() {
    const response = await api.get('/api/type-supports')
    return response.data
  }
}
