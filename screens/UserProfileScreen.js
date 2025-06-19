"use client"

import { Ionicons } from "@expo/vector-icons"
import AsyncStorage from "@react-native-async-storage/async-storage"
import * as ImagePicker from "expo-image-picker"
import { useEffect, useState } from "react"
import {
    ActivityIndicator,
    Alert,
    Image,
    Modal,
    Platform,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native"
import NetworkStatus from "../components/NetworkStatus"
import api from "../services/api"
import { isOnline } from "../services/network"
import NetInfo from "@react-native-community/netinfo"

// Importer les données de démonstration directement
const { demoProfile } = require("../services/demoData")

// Clé unique pour le stockage du profil
const PROFILE_STORAGE_KEY = "user_profile_direct"

const UserProfileScreen = ({ route, navigation }) => {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [profileImage, setProfileImage] = useState(null)
  const [savingProfile, setSavingProfile] = useState(false)
  const [isNetworkAvailable, setIsNetworkAvailable] = useState(true)
  const [pendingChanges, setPendingChanges] = useState(false)

  // États pour gérer le modal de changement de mot de passe
  const [passwordModalVisible, setPasswordModalVisible] = useState(false)
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [passwordError, setPasswordError] = useState("")
  const [changingPassword, setChangingPassword] = useState(false)

  // Vérifier l'état du réseau et synchroniser au retour en ligne
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      const online = state.isConnected && state.isInternetReachable
      setIsNetworkAvailable(online)
      
      // Synchroniser les modifications en attente quand on revient en ligne
      if (online && pendingChanges) {
        handleSaveProfile(true) // silent mode
      }
    })
    
    return () => unsubscribe()
  }, [pendingChanges])

  // Fonction pour initialiser ou récupérer le profil
  const initializeProfile = async () => {
    try {
      console.log("Initialisation/récupération du profil...")

      // Récupérer le profil existant
      const storedProfile = await AsyncStorage.getItem(PROFILE_STORAGE_KEY)

      if (storedProfile) {
        // Si un profil existe, l'utiliser
        const profileData = JSON.parse(storedProfile)
        console.log("Profil existant récupéré:", profileData)
        return profileData
      } else {
        // Sinon, utiliser le profil de démonstration
        console.log("Aucun profil trouvé, utilisation du profil de démonstration:", demoProfile)

        // Sauvegarder le profil de démonstration
        await AsyncStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(demoProfile))

        return demoProfile
      }
    } catch (error) {
      console.error("Erreur lors de l'initialisation du profil:", error)
      // En cas d'erreur, retourner le profil de démonstration sans le sauvegarder
      return demoProfile
    }
  }

  // Charger le profil
  const loadProfile = async () => {
    try {
      setLoading(true)
      const profileData = await initializeProfile()

      // Mettre à jour l'état
      setUser(profileData)
      setName(profileData.name || "")
      setEmail(profileData.email || "")
      setPhone(profileData.phone || "")
      setProfileImage(profileData.profileImage || null)
      setPendingChanges(!!profileData.isPendingSync)

      console.log("Profil chargé avec succès")
    } catch (error) {
      console.error("Erreur lors du chargement du profil:", error)
      Alert.alert("Erreur", "Impossible de charger le profil")
    } finally {
      setLoading(false)
    }
  }

  // Charger le profil au montage du composant
  useEffect(() => {
    loadProfile()
  }, [])

  // Fonction pour gérer le rafraîchissement
  const onRefresh = async () => {
    setRefreshing(true)
    await loadProfile()
    setRefreshing(false)
  }

  // Fonction pour réinitialiser le profil
  const resetProfile = async () => {
    try {
      Alert.alert(
        "Réinitialiser le profil",
        "Êtes-vous sûr de vouloir réinitialiser votre profil ? Cette action est irréversible.",
        [
          { text: "Annuler", style: "cancel" },
          {
            text: "Réinitialiser",
            style: "destructive",
            onPress: async () => {
              setLoading(true)

              // Supprimer le profil existant
              await AsyncStorage.removeItem(PROFILE_STORAGE_KEY)

              // Sauvegarder le profil de démonstration
              await AsyncStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(demoProfile))

              // Recharger le profil
              await loadProfile()

              Alert.alert("Succès", "Profil réinitialisé avec succès")
            },
          },
        ],
      )
    } catch (error) {
      console.error("Erreur lors de la réinitialisation du profil:", error)
      Alert.alert("Erreur", "Impossible de réinitialiser le profil")
      setLoading(false)
    }
  }

  // Fonction pour activer le mode édition
  const handleEditProfile = () => {
    setEditMode(true)
  }

  // Sauvegarder le profil (avec ou sans connexion)
  const handleSaveProfile = async (silent = false) => {
    try {
      setSavingProfile(true)

      // Créer un objet avec les données mises à jour
      const updatedProfile = {
        name,
        email,
        phone,
        profileImage,
        bio: user?.bio,
        address: user?.address,
      }

      if (isNetworkAvailable) {
        // En ligne: essayer de sauvegarder via l'API
        try {
          const apiResponse = await api.put("/users/profile", updatedProfile)
          console.log("Profil mis à jour via l'API:", apiResponse)

          // Mettre à jour l'état avec les données de l'API
          setUser(apiResponse)
          setPendingChanges(false)

          // Sauvegarder également localement
          await AsyncStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify({
            ...apiResponse,
            isPendingSync: false
          }))
          
          setEditMode(false)
          if (!silent) Alert.alert("Succès", "Profil mis à jour avec succès")
          return
        } catch (apiError) {
          console.error("Erreur API:", apiError)
          if (!silent) Alert.alert("Erreur", "Impossible de synchroniser avec le serveur")
        }
      }

      // En cas d'échec de l'API ou si hors ligne, sauvegarder localement
      const localUpdatedProfile = {
        ...user,
        ...updatedProfile,
        updatedAt: new Date().toISOString(),
        isPendingSync: true // Marquer pour synchronisation future
      }

      await AsyncStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(localUpdatedProfile))
      setUser(localUpdatedProfile)
      setPendingChanges(true)

      setEditMode(false)
      if (!silent) Alert.alert("Succès", "Profil mis à jour localement. Les modifications seront synchronisées lorsque vous serez en ligne.")
    } catch (error) {
      console.error("Erreur lors de la sauvegarde du profil:", error)
      if (!silent) Alert.alert("Erreur", "Impossible de sauvegarder les modifications")
    } finally {
      setSavingProfile(false)
    }
  }

  // Fonction pour annuler les modifications
  const handleCancelEdit = () => {
    setName(user?.name || "")
    setEmail(user?.email || "")
    setPhone(user?.phone || "")
    setProfileImage(user?.profileImage || null)
    setEditMode(false)
  }

  // Fonction pour changer le mot de passe
  const handleChangePassword = () => {
    if (!isNetworkAvailable) {
      Alert.alert("Mode hors ligne", "Le changement de mot de passe n'est pas disponible en mode hors ligne. Veuillez vous connecter à Internet pour effectuer cette action.")
      return
    }
    
    setPasswordModalVisible(true)
    setCurrentPassword("")
    setNewPassword("")
    setConfirmPassword("")
    setPasswordError("")
  }

  // Soumettre le changement de mot de passe
  const submitPasswordChange = async () => {
    try {
      // Validation des entrées
      if (!currentPassword.trim()) {
        setPasswordError("Veuillez entrer votre mot de passe actuel")
        return
      }

      if (!newPassword.trim()) {
        setPasswordError("Veuillez entrer un nouveau mot de passe")
        return
      }

      if (newPassword.length < 6) {
        setPasswordError("Le nouveau mot de passe doit contenir au moins 6 caractères")
        return
      }

      if (newPassword !== confirmPassword) {
        setPasswordError("Les mots de passe ne correspondent pas")
        return
      }

      setChangingPassword(true)
      setPasswordError("")

      // Essayer d'abord avec l'endpoint /auth/change-password
      try {
        await api.post("/auth/change-password", {
          currentPassword,
          newPassword,
        })

        // Si la requête réussit, fermer le modal et afficher un message de succès
        setPasswordModalVisible(false)
        Alert.alert("Succès", "Votre mot de passe a été modifié avec succès")
      } catch (changePasswordError) {
        console.log("Erreur avec /auth/change-password, essai avec /auth/password:", changePasswordError)

        // Si l'endpoint /auth/change-password échoue, essayer avec /auth/password
        await api.post("/auth/password", {
          currentPassword,
          newPassword,
        })

        // Si la requête réussit, fermer le modal et afficher un message de succès
        setPasswordModalVisible(false)
        Alert.alert("Succès", "Votre mot de passe a été modifié avec succès")
      }
    } catch (error) {
      console.error("Erreur lors du changement de mot de passe:", error)
      setPasswordError("Une erreur s'est produite. Veuillez réessayer.")
    } finally {
      setChangingPassword(false)
    }
  }

  // Fonction pour sélectionner une image
  const pickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()

      if (status !== "granted") {
        Alert.alert("Permission refusée", "Nous avons besoin de votre permission pour accéder à votre galerie.")
        return
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.5,
        base64: true,
      })

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const newImage = `data:image/jpeg;base64,${result.assets[0].base64}`
        setProfileImage(newImage)
      }
    } catch (error) {
      console.error("Erreur lors de la sélection de l'image:", error)
      Alert.alert("Erreur", "Impossible de sélectionner l'image")
    }
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#00C853" />
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <NetworkStatus />
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.title}>Mon Profil</Text>
        {pendingChanges && (
          <View style={styles.pendingChangesBadge}>
            <Ionicons name="sync" size={16} color="#FFFFFF" />
          </View>
        )}
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#00C853"]} />}
      >
        <View style={styles.profileImageContainer}>
          {profileImage ? (
            <Image source={{ uri: profileImage }} style={styles.profileImage} />
          ) : (
            <View style={styles.profileImagePlaceholder}>
              <Ionicons name="person" size={60} color="#FFFFFF" />
            </View>
          )}
          {editMode && (
            <TouchableOpacity style={styles.changePhotoButton} onPress={pickImage}>
              <Ionicons name="camera" size={20} color="#FFFFFF" />
              <Text style={styles.changePhotoText}>Changer la photo</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Informations personnelles</Text>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Nom</Text>
            {editMode ? (
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="Votre nom"
                placeholderTextColor="#999"
              />
            ) : (
              <Text style={styles.infoValue}>{user?.name || "Non spécifié"}</Text>
            )}
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Email</Text>
            {editMode ? (
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="Votre email"
                placeholderTextColor="#999"
                keyboardType="email-address"
              />
            ) : (
              <Text style={styles.infoValue}>{user?.email || "Non spécifié"}</Text>
            )}
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Téléphone</Text>
            {editMode ? (
              <TextInput
                style={styles.input}
                value={phone}
                onChangeText={setPhone}
                placeholder="Votre numéro de téléphone"
                placeholderTextColor="#999"
                keyboardType="phone-pad"
              />
            ) : (
              <Text style={styles.infoValue}>{user?.phone || "Non spécifié"}</Text>
            )}
          </View>

          {user?.bio && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Bio</Text>
              <Text style={styles.infoValue}>{user.bio}</Text>
            </View>
          )}

          {user?.address && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Adresse</Text>
              <Text style={styles.infoValue}>{user.address}</Text>
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Sécurité</Text>
          <TouchableOpacity 
            style={[styles.securityButton, !isNetworkAvailable && styles.disabledButton]} 
            onPress={handleChangePassword}
            disabled={!isNetworkAvailable}
          >
            <Text style={styles.securityButtonText}>Changer le mot de passe</Text>
            <Ionicons name="chevron-forward" size={20} color="#00C853" />
          </TouchableOpacity>

          <TouchableOpacity style={[styles.securityButton, styles.resetButton]} onPress={resetProfile}>
            <Text style={styles.resetButtonText}>Réinitialiser le profil</Text>
            <Ionicons name="refresh" size={20} color="#FF5252" />
          </TouchableOpacity>
        </View>

        {!isNetworkAvailable && (
          <View style={styles.offlineNotice}>
            <Ionicons name="cloud-offline" size={20} color="#FFC107" />
            <Text style={styles.offlineNoticeText}>Mode hors ligne : Les modifications sont enregistrées localement</Text>
          </View>
        )}

        {!editMode ? (
          <TouchableOpacity style={styles.editButton} onPress={handleEditProfile}>
            <Ionicons name="create-outline" size={20} color="#FFFFFF" />
            <Text style={styles.editButtonText}>Modifier le profil</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.editActions}>
            <TouchableOpacity style={styles.cancelButton} onPress={handleCancelEdit}>
              <Text style={styles.cancelButtonText}>Annuler</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.saveButton, savingProfile && styles.disabledButton]}
              onPress={() => handleSaveProfile()}
              disabled={savingProfile}
            >
              {savingProfile ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.saveButtonText}>Enregistrer</Text>
              )}
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* Modal pour changer le mot de passe */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={passwordModalVisible}
        onRequestClose={() => setPasswordModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.passwordModalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Changer le mot de passe</Text>
              <TouchableOpacity onPress={() => setPasswordModalVisible(false)}>
                <Ionicons name="close" size={24} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            {passwordError ? <Text style={styles.passwordError}>{passwordError}</Text> : null}

            <View style={styles.passwordInputContainer}>
              <Text style={styles.passwordLabel}>Mot de passe actuel</Text>
              <TextInput
                style={styles.passwordInput}
                value={currentPassword}
                onChangeText={setCurrentPassword}
                placeholder="Entrez votre mot de passe actuel"
                placeholderTextColor="#999"
                secureTextEntry
              />
            </View>

            <View style={styles.passwordInputContainer}>
              <Text style={styles.passwordLabel}>Nouveau mot de passe</Text>
              <TextInput
                style={styles.passwordInput}
                value={newPassword}
                onChangeText={setNewPassword}
                placeholder="Entrez votre nouveau mot de passe"
                placeholderTextColor="#999"
                secureTextEntry
              />
            </View>

            <View style={styles.passwordInputContainer}>
              <Text style={styles.passwordLabel}>Confirmer le nouveau mot de passe</Text>
              <TextInput
                style={styles.passwordInput}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="Confirmez votre nouveau mot de passe"
                placeholderTextColor="#999"
                secureTextEntry
              />
            </View>

            <TouchableOpacity
              style={[styles.passwordSubmitButton, changingPassword && styles.disabledButton]}
              onPress={submitPasswordChange}
              disabled={changingPassword}
            >
              {changingPassword ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.passwordSubmitText}>Changer le mot de passe</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#c1dbb0",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#222",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: Platform.OS === "ios" ? 50 : 20,
    paddingBottom: 10,
    backgroundColor: "#c1dbb0"
  },
  backButton: {
    padding: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#FFFFFF",
    flex: 1,
    textAlign: "center",
  },
  pendingChangesBadge: {
    backgroundColor: "#FF9800",
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  scrollView: {
    flex: 1,
  },
  profileImageContainer: {
    alignItems: "center",
    marginVertical: 20,
  },
  profileImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 3,
    borderColor: "#00C853",
  },
  profileImagePlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "#444",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 3,
    borderColor: "#555",
  },
  changePhotoButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#00C853",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginTop: 10,
  },
  changePhotoText: {
    color: "#FFFFFF",
    marginLeft: 8,
  },
  section: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#96c06e",
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#FFFFFF",
    marginBottom: 16,
  },
  infoRow: {
    marginBottom: 16,
  },
  infoLabel: {
    fontSize: 14,
    color: "#999999",
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 16,
    color: "#FFFFFF",
  },
  input: {
    backgroundColor: "#96c06e",
    borderRadius: 8,
    padding: 12,
    color: "#FFFFFF",
    fontSize: 16,
  },
  securityButton: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#96c06e",
    borderRadius: 8,
    padding: 16,
    marginBottom: 10,
  },
  securityButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
  },
  resetButton: {
    backgroundColor: "rgba(255, 82, 82, 0.1)",
  },
  resetButtonText: {
    color: "#FF5252",
    fontSize: 16,
  },
  editButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#00C853",
    borderRadius: 8,
    padding: 16,
    margin: 16,
  },
  editButtonText: {
    color: "#FFFFFF",
    marginLeft: 8,
    fontWeight: "500",
    fontSize: 16,
  },
  editActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    margin: 16,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: "#444",
    borderRadius: 8,
    padding: 16,
    marginRight: 8,
    alignItems: "center",
  },
  cancelButtonText: {
    color: "#FFFFFF",
    fontWeight: "500",
  },
  saveButton: {
    flex: 1,
    backgroundColor: "#00C853",
    borderRadius: 8,
    padding: 16,
    marginLeft: 8,
    alignItems: "center",
  },
  saveButtonText: {
    color: "#FFFFFF",
    fontWeight: "500",
    fontSize: 16,
  },
  disabledButton: {
    opacity: 0.5,
  },
  offlineNotice: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 193, 7, 0.2)",
    borderRadius: 8,
    padding: 12,
    margin: 16,
  },
  offlineNoticeText: {
    color: "#FFC107",
    marginLeft: 8,
    fontSize: 14,
  },
  modalContainer: {
    flex: 1,
    justifyContent: "center",
    backgroundColor: "rgba(0, 0, 0, 0.7)",
  },
  passwordModalContent: {
    backgroundColor: "#222",
    margin: 20,
    borderRadius: 12,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#FFFFFF",
  },
  passwordError: {
    color: "#FF5252",
    marginBottom: 16,
    textAlign: "center",
  },
  passwordInputContainer: {
    marginBottom: 16,
  },
  passwordLabel: {
    fontSize: 14,
    color: "#999999",
    marginBottom: 8,
  },
  passwordInput: {
    backgroundColor: "#333",
    borderRadius: 8,
    padding: 12,
    color: "#FFFFFF",
    fontSize: 16,
  },
  passwordSubmitButton: {
    backgroundColor: "#00C853",
    borderRadius: 8,
    padding: 16,
    alignItems: "center",
    marginTop: 8,
  },
  passwordSubmitText: {
    color: "#FFFFFF",
    fontWeight: "500",
    fontSize: 16,
  },
})

export default UserProfileScreen