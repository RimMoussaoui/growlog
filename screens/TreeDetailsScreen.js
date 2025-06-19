"use client"

import { useState, useEffect, useRef } from "react"
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
  Image,
  FlatList,
  Dimensions,
  Modal,
  TextInput,
} from "react-native"
import { Ionicons } from "@expo/vector-icons"
import * as ImagePicker from "expo-image-picker"
import { Picker } from "@react-native-picker/picker"
import api from "../services/api"
import * as AuthService from "../services/auth"
import OfflineMapView from "../components/OfflineMapView"

const { width } = Dimensions.get("window")

const HistorySection = ({
  treeId,
  treeName,
  availableYears,
  selectedYear,
  setSelectedYear,
  showHistory,
  setShowHistory,
  loadingHistory,
  loadTreeHistory,
  navigation,
  historyData,
}) => {
  const handleAddHistory = () => {
    console.log("Tentative de navigation vers AddHistory")
    console.log("TreeId:", treeId)
    console.log("TreeName:", treeName)

    try {
      navigation.navigate("AddHistory", {
        treeId: treeId,
        treeName: treeName || "Arbre sans nom",
      })
    } catch (error) {
      console.error("Erreur lors de la navigation:", error)
      Alert.alert("Erreur", "Impossible d'ouvrir l'écran d'ajout d'historique")
    }
  }

  const handleRefreshHistory = async () => {
    try {
      console.log("[TreeDetails] Rafraîchissement forcé de l'historique")
      await loadTreeHistory(true)
    } catch (error) {
      console.error("[TreeDetails] Erreur lors du rafraîchissement:", error)
      Alert.alert("Erreur", "Impossible de rafraîchir l'historique")
    }
  }

  return (
    <View style={styles.section}>
      <View style={styles.historyHeader}>
        <Text style={styles.sectionTitle}>Historique</Text>
        <View style={styles.historyActions}>
          <TouchableOpacity style={styles.refreshButton} onPress={handleRefreshHistory}>
            <Ionicons name="refresh" size={24} color="#00C853" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.addHistoryButton} onPress={handleAddHistory}>
            <Ionicons name="add-circle" size={24} color="#00C853" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.historyToggleButton} onPress={() => setShowHistory(!showHistory)}>
            <Ionicons name={showHistory ? "chevron-up" : "chevron-down"} size={20} color="#00C853" />
            <Text style={styles.historyToggleText}>{showHistory ? "Masquer" : "Afficher"}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {showHistory && (
        <>
          {loadingHistory ? (
            <View style={styles.historyLoading}>
              <ActivityIndicator size="small" color="#00C853" />
              <Text style={styles.historyLoadingText}>Chargement de l'historique...</Text>
            </View>
          ) : availableYears.length > 0 ? (
            <View style={styles.yearSelectorContainer}>
              <Text style={styles.yearSelectorLabel}>Sélectionner une année:</Text>
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={selectedYear}
                  onValueChange={(itemValue) => {
                    setSelectedYear(itemValue)
                    navigation.navigate("TreeHistory", {
                      treeId: treeId,
                      year: itemValue,
                      treeName: treeName,
                      initialEntries: historyData[itemValue] || []
                    })
                  }}
                  style={styles.picker}
                  dropdownIconColor="#FFFFFF"
                >
                  {availableYears.map((year) => (
                    <Picker.Item key={year} label={year} value={year} color="#FFFFFF" />
                  ))}
                </Picker>
              </View>
            </View>
          ) : (
            <View style={styles.noHistoryContainer}>
              <Text style={styles.noHistoryText}>Aucun historique enregistré</Text>
              <Text style={styles.noHistorySubText}>Utilisez le bouton "+" pour ajouter un nouvel historique</Text>
            </View>
          )}
        </>
      )}
    </View>
  )
}

const TreeDetailsScreen = ({ route, navigation }) => {
  const { treeId } = route.params

  const [tree, setTree] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [userData, setUserData] = useState({
    name: "Utilisateur inconnu",
    id: "Inconnu",
    date: "Inconnue",
  })

  const mapRef = useRef(null)

  const [activeImageIndex, setActiveImageIndex] = useState(0)
  const [photoModalVisible, setPhotoModalVisible] = useState(false)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [fullscreenImage, setFullscreenImage] = useState(null)

  const [editModalVisible, setEditModalVisible] = useState(false)
  const [editField, setEditField] = useState("")
  const [editValue, setEditValue] = useState("")
  const [editValueNumber, setEditValueNumber] = useState("")
  const [editingHealth, setEditingHealth] = useState(false)
  const [savingField, setSavingField] = useState(false)

  const [showHistory, setShowHistory] = useState(false)
  const [selectedYear, setSelectedYear] = useState(null)
  const [historyData, setHistoryData] = useState({})
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [availableYears, setAvailableYears] = useState([])

  const fetchUserInfo = async (userId) => {
    try {
      console.log("Récupération des informations de l'utilisateur:", userId)

      try {
        const userInfo = await api.get(`/users/${userId}`)
        console.log("Informations utilisateur récupérées:", userInfo)
        return userInfo
      } catch (error) {
        console.log("Erreur lors de la récupération des informations utilisateur:", error)

        const currentUser = await AuthService.getCurrentUser()
        if (currentUser && currentUser._id === userId) {
          return currentUser
        }

        return null
      }
    } catch (error) {
      console.error("Erreur lors de la récupération des informations utilisateur:", error)
      return null
    }
  }

  const loadTreeData = async () => {
    try {
      setLoading(true)
      setError("")

      console.log("Chargement des détails de l'arbre avec ID:", treeId)

      const treeData = await api.get(`/trees/${treeId}`)
      console.log("Données de l'arbre reçues:", JSON.stringify(treeData))

      setTree(treeData)

      let userId = null

      if (treeData.addedByUser && treeData.addedByUser._id) {
        userId = treeData.addedByUser._id
      } else if (treeData.addedByUser && treeData.addedByUser.id) {
        userId = treeData.addedByUser.id
      } else if (treeData.addedBy) {
        userId = treeData.addedBy
      }

      console.log("ID utilisateur trouvé:", userId)

      if (userId) {
        const userInfo = await fetchUserInfo(userId)

        if (userInfo) {
          setUserData({
            name: userInfo.name || "Utilisateur inconnu",
            id: userId,
            date: treeData.createdAt ? new Date(treeData.createdAt).toLocaleDateString() : "Inconnue",
          })
        } else {
          setUserData({
            name: "Utilisateur inconnu",
            id: userId,
            date: treeData.createdAt ? new Date(treeData.createdAt).toLocaleDateString() : "Inconnue",
          })
        }
      } else {
        setUserData({
          name: "Utilisateur inconnu",
          id: "Inconnu",
          date: treeData.createdAt ? new Date(treeData.createdAt).toLocaleDateString() : "Inconnue",
        })
      }
    } catch (error) {
      console.error("Erreur lors du chargement des données de l'arbre:", error)
      setError("Impossible de charger les détails de l'arbre")
    } finally {
      setLoading(false)
    }
  }

  const loadTreeHistory = async (forceRefresh = false) => {
    try {
      setLoadingHistory(true)
      const history = forceRefresh 
        ? await api.get(`/trees/${treeId}/history`, null, true)
        : await api.get(`/trees/${treeId}/history`)
      
      console.log('Historique chargé:', history)
      setHistoryData(history || {})

      const years = Object.keys(history || {})
        .filter(key => /^\d{4}$/.test(key))
        .sort((a, b) => b - a)

      setAvailableYears(years)
      if (years.length > 0 && !selectedYear) {
        setSelectedYear(years[0])
      }
    } catch (error) {
      console.error("Erreur lors du chargement de l'historique:", error)
    } finally {
      setLoadingHistory(false)
    }
  }

  const requestMediaLibraryPermissions = async () => {
    try {
      const { status: libraryStatus } = await ImagePicker.requestMediaLibraryPermissionsAsync()
      const { status: cameraStatus } = await ImagePicker.requestCameraPermissionsAsync()

      if (libraryStatus !== "granted" || cameraStatus !== "granted") {
        Alert.alert(
          "Permissions requises",
          "Nous avons besoin des permissions pour accéder à votre galerie et à votre appareil photo.",
          [{ text: "OK" }],
        )
      }
    } catch (error) {
      console.error("Erreur lors de la demande de permissions:", error)
    }
  }

  useEffect(() => {
    loadTreeData()
    requestMediaLibraryPermissions()
  }, [treeId])

  useEffect(() => {
    const unsubscribe = navigation.addListener("focus", () => {
      if (treeId) {
        loadTreeHistory()
      }
    })
    return unsubscribe
  }, [navigation, treeId])

  const handleDeleteTree = () => {
    Alert.alert("Confirmation", "Êtes-vous sûr de vouloir supprimer cet arbre ? Cette action est irréversible.", [
      { text: "Annuler", style: "cancel" },
      {
        text: "Supprimer",
        style: "destructive",
        onPress: async () => {
          try {
            setLoading(true)
            await api.delete(`/trees/${treeId}`)

            navigation.navigate("ProjectMap", {
              projectId: tree.projectId,
              deletedTreeId: treeId,
              refresh: Date.now(),
            })

            Alert.alert("Succès", "L'arbre a été supprimé avec succès")
          } catch (error) {
            console.error("Erreur lors de la suppression de l'arbre:", error)
            Alert.alert("Erreur", "Impossible de supprimer cet arbre")
            setLoading(false)
          }
        },
      },
    ])
  }

  const openEditModal = (field, value) => {
    setEditField(field)
    if (field === "health") {
      setEditingHealth(true)
      setEditValue(value || "unknown")
      setEditValueNumber("")
    } else if (field === "height" || field === "diameter") {
      setEditingHealth(false)
      setEditValueNumber(value ? value.toString() : "")
      setEditValue("")
    } else {
      setEditValue(value || "")
      setEditValueNumber("")
      setEditingHealth(false)
    }
    setEditModalVisible(true)
  }

  const saveFieldEdit = async () => {
    if (savingField) return

    try {
      setSavingField(true)

      let value
      if (editField === "height" || editField === "diameter") {
        const numValue = Number.parseFloat(editValueNumber)
        if (editValueNumber.trim() === "") {
          value = null
        } else if (isNaN(numValue) || numValue < 0) {
          Alert.alert("Erreur", "Veuillez entrer une valeur numérique positive")
          return
        } else {
          value = numValue
        }
      } else {
        value = editValue
      }

      const updateData = {
        [editField]: value,
      }

      const updatedTree = await api.put(`/trees/${treeId}`, updateData)

      setTree(updatedTree)
      setEditModalVisible(false)
      setEditField("")
      setEditValue("")
      setEditValueNumber("")
      setEditingHealth(false)

      Alert.alert("Succès", "Champ mis à jour avec succès")
    } catch (error) {
      console.error("Erreur lors de la mise à jour:", error)
      Alert.alert("Erreur", "Impossible de mettre à jour ce champ")
    } finally {
      setSavingField(false)
    }
  }

  const addImageToTree = async (newImage) => {
    if (!tree) return

    try {
      const updatedImages = tree.images ? [...tree.images, newImage] : [newImage]

      await api.put(`/trees/${treeId}`, {
        images: updatedImages,
      })

      setTree({ ...tree, images: updatedImages })
      setActiveImageIndex(updatedImages.length - 1)

      Alert.alert("Succès", "La photo a été ajoutée avec succès")
    } catch (error) {
      console.error("Erreur lors de l'ajout de la photo:", error)
      Alert.alert("Erreur", "Impossible d'ajouter la photo")
    } finally {
      setUploadingImage(false)
      setPhotoModalVisible(false)
    }
  }

  const pickImage = async () => {
    try {
      setUploadingImage(true)
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.3,
        base64: true,
      })

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const base64Size = result.assets[0].base64.length * 0.75
        const maxSize = 1024 * 1024

        if (base64Size > maxSize) {
          Alert.alert(
            "Image trop volumineuse",
            "L'image sélectionnée est trop grande. Veuillez choisir une image plus petite.",
          )
          return
        }

        const newImage = `data:image/jpeg;base64,${result.assets[0].base64}`
        await addImageToTree(newImage)
      }
    } catch (error) {
      console.error("Erreur lors de la sélection de l'image:", error)
      Alert.alert("Erreur", "Impossible de sélectionner l'image")
    } finally {
      setUploadingImage(false)
      setPhotoModalVisible(false)
    }
  }

  const takePhoto = async () => {
    try {
      setUploadingImage(true)
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.3,
        base64: true,
      })

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const base64Size = result.assets[0].base64.length * 0.75
        const maxSize = 1024 * 1024

        if (base64Size > maxSize) {
          Alert.alert("Image trop volumineuse", "L'image prise est trop grande. Veuillez réduire la résolution.")
          return
        }

        const newImage = `data:image/jpeg;base64,${result.assets[0].base64}`
        await addImageToTree(newImage)
      }
    } catch (error) {
      console.error("Erreur lors de la prise de photo:", error)
      Alert.alert("Erreur", "Impossible de prendre une photo")
    } finally {
      setUploadingImage(false)
      setPhotoModalVisible(false)
    }
  }

  const deleteImage = (index) => {
    if (!tree || !tree.images || tree.images.length === 0) return

    Alert.alert("Confirmation", "Êtes-vous sûr de vouloir supprimer cette photo ?", [
      { text: "Annuler", style: "cancel" },
      {
        text: "Supprimer",
        style: "destructive",
        onPress: async () => {
          try {
            setLoading(true)

            const updatedImages = [...tree.images]
            updatedImages.splice(index, 1)

            await api.put(`/trees/${treeId}`, {
              images: updatedImages,
            })

            setTree({ ...tree, images: updatedImages })

            if (activeImageIndex >= updatedImages.length) {
              setActiveImageIndex(Math.max(0, updatedImages.length - 1))
            }

            Alert.alert("Succès", "La photo a été supprimée avec succès")
          } catch (error) {
            console.error("Erreur lors de la suppression de la photo:", error)
            Alert.alert("Erreur", "Impossible de supprimer la photo")
          } finally {
            setLoading(false)
          }
        },
      },
    ])
  }

  const getHealthStatusText = (status) => {
    const healthStatuses = {
      good: "Bon",
      fair: "Moyen",
      poor: "Mauvais",
      critical: "Critique",
      dead: "Mort",
      unknown: "Inconnu",
    }
    return healthStatuses[status] || "Inconnu"
  }

  const getHealthStatusColor = (status) => {
    const healthColors = {
      good: "#4CAF50",
      fair: "#FFC107",
      poor: "#FF9800",
      critical: "#F44336",
      dead: "#9E9E9E",
      unknown: "#BDBDBD",
    }
    return healthColors[status] || "#BDBDBD"
  }

  const renderImageThumbnail = ({ item, index }) => (
    <TouchableOpacity
      style={[styles.thumbnailContainer, activeImageIndex === index && styles.activeThumbnail]}
      onPress={() => setActiveImageIndex(index)}
    >
      <Image source={{ uri: item }} style={styles.thumbnail} />
    </TouchableOpacity>
  )

  const renderEditableField = (label, value, field, isNumber = false) => (
    <View style={styles.editableField}>
      <View style={styles.fieldLabelContainer}>
        <Text style={styles.fieldLabel}>{label}</Text>
      </View>
      <View style={styles.fieldValueContainer}>
        <Text style={styles.fieldValue}>
          {value !== null && value !== undefined
            ? isNumber
              ? `${value} ${field === "height" ? "m" : "cm"}`
              : value
            : "Non spécifié"}
        </Text>
        <TouchableOpacity style={styles.editButton} onPress={() => openEditModal(field, value)}>
          <Ionicons name="pencil" size={18} color="#00C853" />
        </TouchableOpacity>
      </View>
    </View>
  )

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#00C853" />
      </View>
    )
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backButtonText}>Retour</Text>
        </TouchableOpacity>
      </View>
    )
  }

  const hasImages = tree?.images && tree.images.length > 0

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.title}>{tree?.name || "Détails de l'arbre"}</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.scrollView}>
        {/* Section des photos */}
        <View style={styles.imagesSection}>
          {hasImages ? (
            <>
              <TouchableOpacity onPress={() => setFullscreenImage(tree.images[activeImageIndex])}>
                <Image source={{ uri: tree.images[activeImageIndex] }} style={styles.mainImage} resizeMode="cover" />
              </TouchableOpacity>

              <View style={styles.imageActions}>
                <TouchableOpacity style={styles.addPhotoButton} onPress={() => setPhotoModalVisible(true)}>
                  <Ionicons name="add-circle" size={24} color="#00C853" />
                  <Text style={styles.addPhotoText}>Ajouter une photo</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.deletePhotoButton} onPress={() => deleteImage(activeImageIndex)}>
                  <Ionicons name="trash" size={24} color="#FF5252" />
                </TouchableOpacity>
              </View>

              {tree.images.length > 1 && (
                <FlatList
                  data={tree.images}
                  renderItem={renderImageThumbnail}
                  keyExtractor={(_, index) => `thumb-${index}`}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.thumbnailList}
                />
              )}
            </>
          ) : (
            <View style={styles.noImagesContainer}>
              <Text style={styles.noImagesText}>Aucune photo disponible</Text>
              <TouchableOpacity style={styles.addFirstPhotoButton} onPress={() => setPhotoModalVisible(true)}>
                <Ionicons name="camera" size={24} color="#FFFFFF" />
                <Text style={styles.addFirstPhotoText}>Ajouter une photo</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* ID de l'arbre */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Identifiant</Text>
          <View style={styles.idField}>
            <Text style={styles.idValue}>{tree?._id || "ID inconnu"}</Text>
          </View>
        </View>

        {/* Informations de base */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Informations de base</Text>
          {renderEditableField("Nom", tree?.name, "name")}
          {renderEditableField("Espèce", tree?.species, "species")}
        </View>

        {/* Description */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Description</Text>
          {renderEditableField("Description", tree?.description, "description")}
        </View>

        {/* Caractéristiques */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Caractéristiques</Text>
          {renderEditableField("Hauteur (m)", tree?.height, "height", true)}
          {renderEditableField("Diamètre (cm)", tree?.diameter, "diameter", true)}

          <View style={styles.editableField}>
            <View style={styles.fieldLabelContainer}>
              <Text style={styles.fieldLabel}>État de santé</Text>
            </View>
            <View style={styles.fieldValueContainer}>
              <View style={[styles.healthBadge, { backgroundColor: getHealthStatusColor(tree?.health) }]}>
                <Text style={styles.healthText}>{getHealthStatusText(tree?.health)}</Text>
              </View>
              <TouchableOpacity style={styles.editButton} onPress={() => openEditModal("health", tree?.health)}>
                <Ionicons name="pencil" size={18} color="#00C853" />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.editableField}>
            <View style={styles.fieldLabelContainer}>
              <Text style={styles.fieldLabel}>Date d'ajout</Text>
            </View>
            <View style={styles.fieldValueContainer}>
              <Text style={styles.fieldValue}>
                {tree?.createdAt ? new Date(tree.createdAt).toLocaleDateString() : "Inconnue"}
              </Text>
            </View>
          </View>
        </View>

        {/* Localisation */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Localisation</Text>
          {renderEditableField("Nom de l'emplacement", tree?.location?.name, "location.name")}

          {tree?.location?.latitude && tree?.location?.longitude ? (
            <View style={styles.mapContainer}>
              <OfflineMapView
                initialRegion={{
                  latitude: tree.location.latitude,
                  longitude: tree.location.longitude,
                  latitudeDelta: 0.005,
                  longitudeDelta: 0.005,
                }}
                markers={[
                  {
                    latitude: tree.location.latitude,
                    longitude: tree.location.longitude,
                    title: tree.name || "Arbre",
                    description: tree.species || "Espèce inconnue",
                    type: "tree",
                    treeId: tree._id,
                  },
                ]}
                mapType="standard"
                style={styles.map}
                zoomEnabled={true}
                scrollEnabled={true}
              />
              <TouchableOpacity style={styles.expandMapButton}>
                <Ionicons name="expand" size={20} color="#FFFFFF" />
                <Text style={styles.expandMapText}>Agrandir la carte</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.locateButton} onPress={() => {}}>
                <Ionicons name="locate" size={20} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          ) : (
            <Text style={styles.noLocationText}>Aucune coordonnée GPS disponible</Text>
          )}
        </View>

        {/* Section Historique */}
        <HistorySection
          treeId={treeId}
          treeName={tree?.name}
          availableYears={availableYears}
          selectedYear={selectedYear}
          setSelectedYear={setSelectedYear}
          showHistory={showHistory}
          setShowHistory={setShowHistory}
          loadingHistory={loadingHistory}
          loadTreeHistory={loadTreeHistory}
          navigation={navigation}
          historyData={historyData}
        />

        <TouchableOpacity style={styles.deleteButton} onPress={handleDeleteTree}>
          <Ionicons name="trash-outline" size={20} color="#FFFFFF" />
          <Text style={styles.deleteButtonText}>Supprimer cet arbre</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Modal pour ajouter des photos */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={photoModalVisible}
        onRequestClose={() => setPhotoModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Ajouter une photo</Text>
              <TouchableOpacity onPress={() => setPhotoModalVisible(false)}>
                <Ionicons name="close" size={24} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            <View style={styles.photoOptions}>
              <TouchableOpacity
                style={[styles.photoOptionButton, uploadingImage && styles.disabledButton]}
                onPress={pickImage}
                disabled={uploadingImage}
              >
                <Ionicons name="images" size={40} color="#00C853" />
                <Text style={styles.photoOptionText}>Galerie</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.photoOptionButton, uploadingImage && styles.disabledButton]}
                onPress={takePhoto}
                disabled={uploadingImage}
              >
                <Ionicons name="camera" size={40} color="#00C853" />
                <Text style={styles.photoOptionText}>Appareil photo</Text>
              </TouchableOpacity>
            </View>

            {uploadingImage && (
              <View style={styles.uploadingContainer}>
                <ActivityIndicator size="large" color="#00C853" />
                <Text style={styles.uploadingText}>Chargement de l'image...</Text>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* Modal pour éditer un champ */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={editModalVisible}
        onRequestClose={() => setEditModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                Modifier{" "}
                {editField === "name"
                  ? "le nom"
                  : editField === "species"
                    ? "l'espèce"
                    : editField === "description"
                      ? "la description"
                      : editField === "height"
                        ? "la hauteur"
                        : editField === "diameter"
                          ? "le diamètre"
                          : editField === "health"
                            ? "l'état de santé"
                            : editField === "location.name"
                              ? "le nom de l'emplacement"
                              : "le champ"}
              </Text>
              <TouchableOpacity onPress={() => setEditModalVisible(false)}>
                <Ionicons name="close" size={24} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            {editingHealth ? (
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={editValue}
                  onValueChange={(itemValue) => setEditValue(itemValue)}
                  style={styles.picker}
                  dropdownIconColor="#FFFFFF"
                >
                  <Picker.Item label="Bon" value="good" color="#2b2b2b" />
                  <Picker.Item label="Moyen" value="fair" color="#2b2b2b" />
                  <Picker.Item label="Mauvais" value="poor" color="#2b2b2b" />
                  <Picker.Item label="Critique" value="critical" color="#2b2b2b" />
                  <Picker.Item label="Mort" value="dead" color="#2b2b2b" />
                  <Picker.Item label="Inconnu" value="unknown" color="#2b2b2b" />
                </Picker>
              </View>
            ) : (
              <TextInput
                style={[styles.editInput, editField === "description" && styles.editTextArea]}
                value={editField === "height" || editField === "diameter" ? editValueNumber : editValue}
                onChangeText={editField === "height" || editField === "diameter" ? setEditValueNumber : setEditValue}
                placeholder={`Entrez ${
                  editField === "name"
                    ? "le nom"
                    : editField === "species"
                      ? "l'espèce"
                      : editField === "description"
                        ? "la description"
                        : editField === "height"
                          ? "la hauteur en mètres (ex: 2.5)"
                          : editField === "diameter"
                            ? "le diamètre en centimètres (ex: 25.5)"
                            : editField === "location.name"
                              ? "le nom de l'emplacement"
                              : "la valeur"
                }`}
                placeholderTextColor="#999"
                multiline={editField === "description"}
                numberOfLines={editField === "description" ? 4 : 1}
                keyboardType={editField === "height" || editField === "diameter" ? "decimal-pad" : "default"}
              />
            )}

            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.cancelButton]} onPress={() => setEditModalVisible(false)}>
                <Text style={styles.cancelButtonText}>Annuler</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.saveButton, savingField && styles.disabledButton]}
                onPress={saveFieldEdit}
                disabled={savingField}
              >
                {savingField ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.saveButtonText}>Enregistrer</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal pour afficher l'image en plein écran */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={fullscreenImage !== null}
        onRequestClose={() => setFullscreenImage(null)}
      >
        <View style={styles.fullscreenContainer}>
          <TouchableOpacity style={styles.fullscreenCloseButton} onPress={() => setFullscreenImage(null)}>
            <Ionicons name="close-circle" size={36} color="#FFFFFF" />
          </TouchableOpacity>
          <Image source={{ uri: fullscreenImage }} style={styles.fullscreenImage} resizeMode="contain" />
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
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#222",
    padding: 20,
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
  scrollView: {
    flex: 1,
  },
  imagesSection: {
    marginBottom: 16,
  },
  mainImage: {
    width: "100%",
    height: 250,
  },
  imageActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  addPhotoButton: {
    flexDirection: "row",
    alignItems: "center",
  },
  addPhotoText: {
    color: "#00C853",
    marginLeft: 8,
    fontWeight: "500",
  },
  deletePhotoButton: {
    padding: 8,
  },
  thumbnailList: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
 
  thumbnailContainer: {
    marginRight: 10,
    borderRadius: 8,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "transparent",
  },
  activeThumbnail: {
    borderColor: "#00C853",
  },
  thumbnail: {
    width: 60,
    height: 60,
  },
  noImagesContainer: {
    height: 200,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#333",
    borderRadius: 8,
    margin: 16,
  },
  noImagesText: {
    color: "#CCCCCC",
    marginBottom: 16,
  },
  addFirstPhotoButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#00C853",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
  addFirstPhotoText: {
    color: "#FFFFFF",
    marginLeft: 8,
    fontWeight: "500",
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
  idField: {
    backgroundColor: "#96c06e",
    padding: 12,
    borderRadius: 8,
  },
  idValue: {
    color: "#AAAAAA",
    fontSize: 14,
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
  },
  editableField: {
    marginBottom: 16,
  },
  fieldLabelContainer: {
    marginBottom: 4,
  },
  fieldLabel: {
    fontSize: 14,
    color: "#96c06e",
  },
  fieldValueContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#96c06e",
    borderRadius: 8,
    padding: 12,
  },
  fieldValue: {
    color: "#FFFFFF",
    fontSize: 16,
    flex: 1,
  },
  editButton: {
    padding: 8,
  },
  healthBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  healthText: {
    color: "#FFFFFF",
    fontWeight: "bold",
    fontSize: 14,
  },
  mapContainer: {
    height: 200,
    borderRadius: 8,
    overflow: "hidden",
    marginTop: 8,
  },
  map: {
    width: "100%",
    height: "100%",
  },
  expandMapButton: {
    position: "absolute",
    bottom: 10,
    right: 10,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    flexDirection: "row",
    alignItems: "center",
    padding: 8,
    borderRadius: 4,
  },
  expandMapText: {
    color: "#FFFFFF",
    marginLeft: 4,
    fontSize: 12,
  },
  noLocationText: {
    color: "#999999",
    fontStyle: "italic",
  },
  deleteButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FF5252",
    borderRadius: 8,
    padding: 12,
    margin: 16,
  },
  deleteButtonText: {
    color: "#FFFFFF",
    marginLeft: 8,
    fontWeight: "500",
  },
  errorText: {
    color: "#FF5252",
    textAlign: "center",
    marginBottom: 20,
    fontSize: 16,
  },
  backButtonText: {
    color: "#00C853",
    fontSize: 16,
    fontWeight: "500",
  },
  modalContainer: {
    flex: 1,
    justifyContent: "center",
    backgroundColor: "rgba(0, 0, 0, 0.7)",
  },
  modalContent: {
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
  photoOptions: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginVertical: 20,
  },
  photoOptionButton: {
    alignItems: "center",
    padding: 16,
  },
  disabledButton: {
    opacity: 0.5,
  },
  photoOptionText: {
    color: "#FFFFFF",
    marginTop: 8,
    fontSize: 16,
  },
  uploadingContainer: {
    alignItems: "center",
    marginTop: 20,
  },
  uploadingText: {
    color: "#FFFFFF",
    marginTop: 10,
  },
  fullscreenContainer: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.9)",
    justifyContent: "center",
    alignItems: "center",
  },
  fullscreenImage: {
    width: "100%",
    height: "80%",
  },
  fullscreenCloseButton: {
    position: "absolute",
    top: 40,
    right: 20,
    zIndex: 10,
  },
  editInput: {
    backgroundColor: "#333",
    borderRadius: 8,
    padding: 15,
    marginBottom: 20,
    color: "#FFFFFF",
  },
  editTextArea: {
    height: 100,
    textAlignVertical: "top",
  },
  pickerContainer: {
    backgroundColor: "#333",
    borderRadius: 8,
    marginBottom: 20,
    overflow: "hidden",
  },
  picker: {
    color: "#FFFFFF",
    backgroundColor: "#333",
    height: 50,
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  cancelButton: {
    flex: 1,
    backgroundColor: "#444",
    borderRadius: 8,
    padding: 12,
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
    padding: 12,
    marginLeft: 8,
    alignItems: "center",
  },
  saveButtonText: {
    color: "#FFFFFF",
    fontWeight: "500",
  },
  historyHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  historyToggleButton: {
    flexDirection: "row",
    alignItems: "center",
  },
  historyToggleText: {
    color: "#00C853",
    marginLeft: 4,
  },
  yearSelectorContainer: {
    marginBottom: 16,
  },
  yearSelectorLabel: {
    fontSize: 14,
    color: "#999999",
    marginBottom: 8,
  },
  historyLoading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  historyLoadingText: {
    color: "#CCCCCC",
    marginLeft: 10,
  },
  historyDataContainer: {
    backgroundColor: "#333",
    borderRadius: 8,
    padding: 16,
  },
  historyRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  historyItem: {
    flex: 1,
  },
  historyLabel: {
    fontSize: 14,
    color: "#999999",
    marginBottom: 4,
  },
  historyValue: {
    fontSize: 16,
    color: "#FFFFFF",
  },
  historyEmptyContainer: {
    padding: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#333",
    borderRadius: 8,
  },
  historyEmptyText: {
    color: "#999999",
    fontStyle: "italic",
  },
  historyNotes: {
    marginTop: 8,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#444",
  },
  historyNotesLabel: {
    fontSize: 14,
    color: "#999999",
    marginBottom: 4,
  },
  historyNotesText: {
    fontSize: 16,
    color: "#FFFFFF",
    fontStyle: "italic",
  },
  historyActions: {
    flexDirection: "row",
    alignItems: "center",
  },
  addHistoryButton: {
    marginRight: 16,
    padding: 4,
  },
  noHistoryContainer: {
    padding: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#333",
    borderRadius: 8,
  },
  noHistoryText: {
    color: "#FFFFFF",
    fontSize: 16,
    marginBottom: 8,
  },
  noHistorySubText: {
    color: "#999999",
    fontStyle: "italic",
  },
  locateButton: {
    position: "absolute",
    bottom: 10,
    left: 10,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    flexDirection: "row",
    alignItems: "center",
    padding: 8,
    borderRadius: 4,
  },
  syncButton: {
    marginRight: 12,
    padding: 4,
  },
  refreshButton: {
    marginRight: 12,
    padding: 4,
  },
})

export default TreeDetailsScreen