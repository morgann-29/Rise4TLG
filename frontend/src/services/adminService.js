import api from './api'

export const adminService = {
  // ============================================
  // USERS
  // ============================================

  // Liste tous les utilisateurs avec leurs profils
  async getUsers() {
    const response = await api.get('/api/admin/users')
    return response.data
  },

  // Creer un nouvel utilisateur
  async createUser(userData) {
    const response = await api.post('/api/admin/users', userData)
    return response.data
  },

  // Recuperer un utilisateur par son ID
  async getUser(userId) {
    const response = await api.get(`/api/admin/users/${userId}`)
    return response.data
  },

  // Mettre a jour l'identite d'un utilisateur
  async updateUser(userId, identityData) {
    const response = await api.put(`/api/admin/users/${userId}`, identityData)
    return response.data
  },

  // Supprimer un utilisateur
  async deleteUser(userId) {
    await api.delete(`/api/admin/users/${userId}`)
  },

  // Renvoyer l'email d'invitation
  async resendInvite(userId) {
    const response = await api.post(`/api/admin/users/${userId}/resend-invite`)
    return response.data
  },

  // ============================================
  // PROFILES
  // ============================================

  // Liste tous les profils (optionnellement filtres par user_id)
  async getProfiles(userId = null) {
    const params = userId ? { user_id: userId } : {}
    const response = await api.get('/api/admin/profiles', { params })
    return response.data
  },

  // Creer un nouveau profil
  async createProfile(profileData) {
    const response = await api.post('/api/admin/profiles', profileData)
    return response.data
  },

  // Recuperer un profil par son ID
  async getProfile(profileId) {
    const response = await api.get(`/api/admin/profiles/${profileId}`)
    return response.data
  },

  // Mettre a jour un profil
  async updateProfile(profileId, profileData) {
    const response = await api.put(`/api/admin/profiles/${profileId}`, profileData)
    return response.data
  },

  // Supprimer un profil
  async deleteProfile(profileId) {
    await api.delete(`/api/admin/profiles/${profileId}`)
  },

  // ============================================
  // TYPE PROFIL (referentiel)
  // ============================================

  // Liste les types de profil disponibles
  async getTypeProfiles() {
    const response = await api.get('/api/type-profiles')
    return response.data
  },

  // ============================================
  // TYPE SUPPORT (referentiel)
  // ============================================

  async getTypeSupports() {
    const response = await api.get('/api/type-supports')
    return response.data
  },

  async createTypeSupport(data) {
    const response = await api.post('/api/type-supports', data)
    return response.data
  },

  async updateTypeSupport(id, data) {
    const response = await api.put(`/api/type-supports/${id}`, data)
    return response.data
  },

  async deleteTypeSupport(id) {
    await api.delete(`/api/type-supports/${id}`)
  },

  // ============================================
  // TYPE SEANCE (referentiel)
  // ============================================

  async getTypeSeances(includeDeleted = false) {
    const response = await api.get('/api/type-seances', {
      params: { include_deleted: includeDeleted }
    })
    return response.data
  },

  async createTypeSeance(data) {
    const response = await api.post('/api/type-seances', data)
    return response.data
  },

  async updateTypeSeance(id, data) {
    const response = await api.put(`/api/type-seances/${id}`, data)
    return response.data
  },

  async deleteTypeSeance(id) {
    await api.delete(`/api/type-seances/${id}`)
  },

  async restoreTypeSeance(id) {
    const response = await api.post(`/api/type-seances/${id}/restore`)
    return response.data
  },

  // ============================================
  // WORK LEAD TYPE (referentiel - axes de travail)
  // ============================================

  async getWorkLeadTypes(includeDeleted = false) {
    const response = await api.get('/api/work-lead-types', {
      params: { include_deleted: includeDeleted }
    })
    return response.data
  },

  async createWorkLeadType(data) {
    const response = await api.post('/api/work-lead-types', data)
    return response.data
  },

  async updateWorkLeadType(id, data) {
    const response = await api.put(`/api/work-lead-types/${id}`, data)
    return response.data
  },

  async deleteWorkLeadType(id) {
    await api.delete(`/api/work-lead-types/${id}`)
  },

  async restoreWorkLeadType(id) {
    const response = await api.post(`/api/work-lead-types/${id}/restore`)
    return response.data
  }
}
