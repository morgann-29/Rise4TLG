import api from './api'

export const sessionMasterService = {
  // ============================================
  // MODELES (profile_id = NULL, group_id = NULL)
  // ============================================

  async getModels(includeDeleted = false) {
    const response = await api.get('/api/session-masters/models', {
      params: {
        include_deleted: includeDeleted
      }
    })
    return response.data
  },

  async getModel(id) {
    const response = await api.get(`/api/session-masters/models/${id}`)
    return response.data
  },

  async createModel(data) {
    const response = await api.post('/api/session-masters/models', data)
    return response.data
  },

  async updateModel(id, data) {
    const response = await api.put(`/api/session-masters/models/${id}`, data)
    return response.data
  },

  async deleteModel(id) {
    await api.delete(`/api/session-masters/models/${id}`)
  },

  async restoreModel(id) {
    const response = await api.post(`/api/session-masters/models/${id}/restore`)
    return response.data
  },

  // ============================================
  // TYPE SEANCES (pour dropdown)
  // ============================================

  async getTypeSeances() {
    const response = await api.get('/api/session-masters/type-seances')
    return response.data
  }
}
