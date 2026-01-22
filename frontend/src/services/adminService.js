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
  }
}
