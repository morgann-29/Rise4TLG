import api from './api'

export const profileService = {
  // Recuperer tous les profils de l'utilisateur connecte avec le profil actif
  async getMyProfiles() {
    const response = await api.get('/api/profiles/my-profiles')
    return response.data
  },

  // Changer de profil actif
  async switchProfile(profileId) {
    const response = await api.post(`/api/profiles/switch/${profileId}`)
    return response.data
  },
}
