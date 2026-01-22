import api from './api'

export const workLeadMasterService = {
  // ============================================
  // MODELES (group_id = NULL)
  // ============================================

  async getModels(includeDeleted = false, includeArchived = false) {
    const response = await api.get('/api/work-lead-masters/models', {
      params: {
        include_deleted: includeDeleted,
        include_archived: includeArchived
      }
    })
    return response.data
  },

  async getModel(id) {
    const response = await api.get(`/api/work-lead-masters/models/${id}`)
    return response.data
  },

  async createModel(data) {
    const response = await api.post('/api/work-lead-masters/models', data)
    return response.data
  },

  async updateModel(id, data) {
    const response = await api.put(`/api/work-lead-masters/models/${id}`, data)
    return response.data
  },

  async deleteModel(id) {
    await api.delete(`/api/work-lead-masters/models/${id}`)
  },

  async restoreModel(id) {
    const response = await api.post(`/api/work-lead-masters/models/${id}/restore`)
    return response.data
  },

  async archiveModel(id) {
    const response = await api.post(`/api/work-lead-masters/models/${id}/archive`)
    return response.data
  },

  async unarchiveModel(id) {
    const response = await api.post(`/api/work-lead-masters/models/${id}/unarchive`)
    return response.data
  },

  // ============================================
  // WORK LEAD TYPES (pour dropdown)
  // ============================================

  async getWorkLeadTypes() {
    const response = await api.get('/api/work-lead-types')
    return response.data
  }
}
