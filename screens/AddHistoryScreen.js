"use client"

import { useState, useEffect } from "react"
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Platform,
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
} from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { Picker } from "@react-native-picker/picker"
import DateTimePicker from "@react-native-community/datetimepicker"
import * as ImagePicker from "expo-image-picker"
import * as AuthService from "../services/auth"
import { addHistoryToTree, debugHistory } from "../services/historyService"
import AsyncStorage from "@react-native-async-storage/async-storage"
import { isOnline } from "../services/network"

// Clé pour le stockage local des historiques en attente
const PENDING_HISTORY_KEY = "@pending_history_entries"

const AddHistoryScreen = ({ route, navigation }) => {
  const { treeId, treeName } = route.params

  // États pour les champs du formulaire
  const [date, setDate] = useState(new Date())
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [height, setHeight] = useState("")
  const [diameter, setDiameter] = useState("")
  const [health, setHealth] = useState("unknown")
  const [notes, setNotes] = useState("")
  const [oliveQuantity, setOliveQuantity] = useState("")
  const [oilQuantity, setOilQuantity] = useState("")
  const [images, setImages] = useState([])
  const [observations, setObservations] = useState("")
  const [saving, setSaving] = useState(false)
  const [isOffline, setIsOffline] = useState(false)

  // États pour la validation
  const [errors, setErrors] = useState({})

  // Vérifier l'état de la connexion au montage
  useEffect(() => {
    const checkConnection = async () => {
      const online = await isOnline()
      setIsOffline(!online)
    }
    
    checkConnection()
  }, [])

  const healthOptions = [
    { label: "Bon", value: "good" },
    { label: "Moyen", value: "fair" },
    { label: "Mauvais", value: "poor" },
    { label: "Critique", value: "critical" },
    { label: "Mort", value: "dead" },
    { label: "Inconnu", value: "unknown" },
  ]

  const validateForm = () => {
    const newErrors = {}

    // Validation de la hauteur
    if (height.trim() !== "") {
      const heightValue = Number.parseFloat(height)
      if (isNaN(heightValue) || heightValue < 0) {
        newErrors.height = "La hauteur doit être un nombre positif"
      }
    }

    // Validation du diamètre
    if (diameter.trim() !== "") {
      const diameterValue = Number.parseFloat(diameter)
      if (isNaN(diameterValue) || diameterValue < 0) {
        newErrors.diameter = "Le diamètre doit être un nombre positif"
      }
    }

    // Validation de la quantité d'olives
    if (oliveQuantity.trim() !== "") {
      const oliveValue = Number.parseFloat(oliveQuantity)
      if (isNaN(oliveValue) || oliveValue < 0) {
        newErrors.oliveQuantity = "La quantité d'olives doit être un nombre positif"
      }
    }

    // Validation de la quantité d'huile
    if (oilQuantity.trim() !== "") {
      const oilValue = Number.parseFloat(oilQuantity)
      if (isNaN(oilValue) || oilValue < 0) {
        newErrors.oilQuantity = "La quantité d'huile doit être un nombre positif"
      }
    }

    // Au moins un champ doit être rempli
    if (
      height.trim() === "" &&
      diameter.trim() === "" &&
      health === "unknown" &&
      notes.trim() === "" &&
      oliveQuantity.trim() === "" &&
      oilQuantity.trim() === "" &&
      observations.trim() === "" &&
      images.length === 0
    ) {
      newErrors.general = "Veuillez remplir au moins un champ"
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  // Sauvegarder l'historique en attente localement
  const savePendingHistory = async (historyEntry) => {
    try {
      // Charger les historiques existants
      const pendingEntries = await AsyncStorage.getItem(PENDING_HISTORY_KEY)
      const entries = pendingEntries ? JSON.parse(pendingEntries) : []
      
      // Ajouter le nouvel historique
      entries.push({
        treeId,
        historyEntry,
        timestamp: Date.now()
      })
      
      // Sauvegarder
      await AsyncStorage.setItem(PENDING_HISTORY_KEY, JSON.stringify(entries))
      
      return true
    } catch (error) {
      console.error("Erreur de sauvegarde locale:", error)
      return false
    }
  }

  // Fonction pour ajouter une image depuis la galerie
  const addImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()

      if (status !== "granted") {
        Alert.alert("Permission refusée", "Nous avons besoin de votre permission pour accéder à votre galerie.")
        return
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.5,
        base64: true,
      })

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const base64Size = result.assets[0].base64.length * 0.75
        const maxSize = 2 * 1024 * 1024 // 2MB

        if (baseSize > maxSize) {
          Alert.alert(
            "Image trop volumineuse",
            "L'image sélectionnée est trop grande. Veuillez choisir une image plus petite.",
          )
          return
        }

        const newImage = `data:image/jpeg;base64,${result.assets[0].base64}`
        setImages([...images, newImage])
      }
    } catch (error) {
      console.error("Erreur lors de la sélection de l'image:", error)
      Alert.alert("Erreur", "Impossible de sélectionner l'image")
    }
  }

  // Fonction pour prendre une photo
  const takePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync()

      if (status !== "granted") {
        Alert.alert("Permission refusée", "Nous avons besoin de votre permission pour accéder à votre appareil photo.")
        return
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.5,
        base64: true,
      })

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const base64Size = result.assets[0].base64.length * 0.75
        const maxSize = 2 * 1024 * 1024 // 2MB

        if (base64Size > maxSize) {
          Alert.alert("Image trop volumineuse", "L'image prise est trop grande. Veuillez réduire la qualité.")
          return
        }

        const newImage = `data:image/jpeg;base64,${result.assets[0].base64}`
        setImages([...images, newImage])
      }
    } catch (error) {
      console.error("Erreur lors de la prise de photo:", error)
      Alert.alert("Erreur", "Impossible de prendre une photo")
    }
  }

  // Fonction pour supprimer une image
  const removeImage = (index) => {
    const updatedImages = [...images]
    updatedImages.splice(index, 1)
    setImages(updatedImages)
  }

  const saveHistory = async () => {
    if (!validateForm()) {
      return
    }

    try {
      setSaving(true)
      console.log("[AddHistory] Début de la sauvegarde")

      // Vérifier à nouveau la connexion
      const online = await isOnline()
      setIsOffline(!online)

      // Récupérer les informations de l'utilisateur actuel
      let userName = "Utilisateur"
      try {
        const currentUser = await AuthService.getCurrentUser()
        if (currentUser) {
          userName = currentUser.name || "Utilisateur"
        }
      } catch (userError) {
        console.log("Impossible de récupérer l'utilisateur, utilisation du nom par défaut")
      }

      // Préparer les données de l'historique
      const historyEntry = {
        date: date.toISOString(),
        height: height.trim() !== "" ? Number.parseFloat(height) : null,
        diameter: diameter.trim() !== "" ? Number.parseFloat(diameter) : null,
        health: health !== "unknown" ? health : null,
        notes: notes.trim() !== "" ? notes.trim() : null,
        oliveQuantity: oliveQuantity.trim() !== "" ? Number.parseFloat(oliveQuantity) : null,
        oilQuantity: oilQuantity.trim() !== "" ? Number.parseFloat(oilQuantity) : null,
        images: images.length > 0 ? images : null,
        observations: observations.trim() !== "" ? observations.split("\n").filter((obs) => obs.trim() !== "") : null,
        recordedBy: userName,
        timestamp: Date.now(),
      }

      console.log("[AddHistory] Données à sauvegarder:", historyEntry)

      if (online) {
        // Mode en ligne - sauvegarder normalement
        const result = await addHistoryToTree(treeId, historyEntry)

        console.log("[AddHistory] Résultat de la sauvegarde:", result)

        if (result.success) {
          console.log("[AddHistory] Sauvegarde réussie")

          // Debug: afficher l'historique après sauvegarde
          await debugHistory(treeId)

          // Utiliser le message approprié selon le résultat
          const message =
            result.message ||
            (result.online
              ? "L'historique a été ajouté avec succès"
              : "L'historique a été enregistré localement et sera synchronisé quand la connexion sera rétablie")

          Alert.alert("Succès", message, [
            {
              text: "OK",
              onPress: () => navigation.goBack(),
            },
          ])
        } else {
          throw new Error(result.error || "Échec de la sauvegarde")
        }
      } else {
        // Mode hors ligne - sauvegarder localement
        const saveResult = await savePendingHistory(historyEntry)
        
        if (saveResult) {
          Alert.alert(
            "Succès", 
            "L'historique a été enregistré localement. Il sera synchronisé automatiquement quand la connexion sera rétablie.",
            [{ text: "OK", onPress: () => navigation.goBack() }]
          )
        } else {
          throw new Error("Échec de la sauvegarde locale")
        }
      }
    } catch (error) {
      console.error("Erreur lors de la sauvegarde de l'historique:", error)
      Alert.alert(
        "Erreur",
        `Impossible de sauvegarder l'historique: ${error.message}. Vérifiez votre connexion et réessayez.`,
      )
    } finally {
      setSaving(false)
    }
  }

  const onDateChange = (event, selectedDate) => {
    setShowDatePicker(Platform.OS === "ios")
    if (selectedDate) {
      setDate(selectedDate)
    }
  }

  const formatDate = (date) => {
    return date.toLocaleDateString("fr-FR", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    })
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 100 : 0}
    >
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.title}>Ajouter un historique</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Informations de l'arbre */}
        <View style={styles.treeInfoSection}>
          <Text style={styles.treeInfoTitle}>Arbre sélectionné</Text>
          <Text style={styles.treeInfoName}>{treeName || "Arbre sans nom"}</Text>
          <Text style={styles.treeInfoId}>ID: {treeId}</Text>
        </View>

        {/* Bannière mode hors ligne */}
        {isOffline && (
          <View style={styles.offlineBanner}>
            <Ionicons name="cloud-offline" size={16} color="#000" />
            <Text style={styles.offlineText}>Mode hors ligne - Les données seront sauvegardées localement</Text>
          </View>
        )}

        {/* Erreur générale */}
        {errors.general && <Text style={styles.errorText}>{errors.general}</Text>}

        {/* Section Date */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Date de l'observation</Text>
          <TouchableOpacity style={styles.dateButton} onPress={() => setShowDatePicker(true)}>
            <Ionicons name="calendar" size={20} color="#00C853" />
            <Text style={styles.dateText}>{formatDate(date)}</Text>
            <Ionicons name="chevron-down" size={20} color="#FFFFFF" />
          </TouchableOpacity>

          {showDatePicker && (
            <DateTimePicker
              value={date}
              mode="date"
              display={Platform.OS === "ios" ? "spinner" : "default"}
              onChange={onDateChange}
              maximumDate={new Date()}
            />
          )}
        </View>

        {/* Section Mesures */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Mesures</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Hauteur (mètres)</Text>
            <TextInput
              style={[styles.input, errors.height && styles.inputError]}
              value={height}
              onChangeText={setHeight}
              placeholder="Ex: 2.5"
              placeholderTextColor="#999"
              keyboardType="decimal-pad"
            />
            {errors.height && <Text style={styles.inputErrorText}>{errors.height}</Text>}
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Diamètre (centimètres)</Text>
            <TextInput
              style={[styles.input, errors.diameter && styles.inputError]}
              value={diameter}
              onChangeText={setDiameter}
              placeholder="Ex: 25.5"
              placeholderTextColor="#999"
              keyboardType="decimal-pad"
            />
            {errors.diameter && <Text style={styles.inputErrorText}>{errors.diameter}</Text>}
          </View>
        </View>

        {/* Section État de santé */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>État de santé</Text>
          <View style={styles.pickerContainer}>
            <Picker
              selectedValue={health}
              onValueChange={(itemValue) => setHealth(itemValue)}
              style={styles.picker}
              dropdownIconColor="#FFFFFF"
            >
              {healthOptions.map((option) => (
                <Picker.Item key={option.value} label={option.label} value={option.value} color="#0C0F0A" />
              ))}
            </Picker>
          </View>
        </View>

        {/* Section Récolte */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Récolte</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Quantité d'olives (kg)</Text>
            <TextInput
              style={[styles.input, errors.oliveQuantity && styles.inputError]}
              value={oliveQuantity}
              onChangeText={setOliveQuantity}
              placeholder="Ex: 15.5"
              placeholderTextColor="#999"
              keyboardType="decimal-pad"
            />
            {errors.oliveQuantity && <Text style={styles.inputErrorText}>{errors.oliveQuantity}</Text>}
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Quantité d'huile (litres)</Text>
            <TextInput
              style={[styles.input, errors.oilQuantity && styles.inputError]}
              value={oilQuantity}
              onChangeText={setOilQuantity}
              placeholder="Ex: 3.2"
              placeholderTextColor="#999"
              keyboardType="decimal-pad"
            />
            {errors.oilQuantity && <Text style={styles.inputErrorText}>{errors.oilQuantity}</Text>}
          </View>
        </View>

        {/* Section Notes et observations */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notes et observations</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Notes générales</Text>
            <TextInput
              style={styles.textArea}
              value={notes}
              onChangeText={setNotes}
              placeholder="Ajoutez vos notes générales..."
              placeholderTextColor="#999"
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Observations détaillées (une par ligne)</Text>
            <TextInput
              style={styles.textArea}
              value={observations}
              onChangeText={setObservations}
              placeholder="Observation 1&#10;Observation 2&#10;Observation 3..."
              placeholderTextColor="#999"
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>
        </View>

        {/* Section Photos */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Photos</Text>

          <View style={styles.photoButtons}>
            <TouchableOpacity style={styles.photoButton} onPress={addImage}>
              <Ionicons name="images" size={24} color="#FFFFFF" />
              <Text style={styles.photoButtonText}>Galerie</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.photoButton} onPress={takePhoto}>
              <Ionicons name="camera" size={24} color="#FFFFFF" />
              <Text style={styles.photoButtonText}>Appareil photo</Text>
            </TouchableOpacity>
          </View>

          {images.length > 0 && (
            <View style={styles.imagePreviewContainer}>
              <Text style={styles.imageCountText}>{images.length} photo(s) ajoutée(s)</Text>
              {images.map((image, index) => (
                <View key={index} style={styles.imagePreview}>
                  <Image source={{ uri: image }} style={styles.previewImage} />
                  <TouchableOpacity style={styles.removeImageButton} onPress={() => removeImage(index)}>
                    <Ionicons name="close-circle" size={24} color="#FF5252" />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Boutons d'action */}
        <View style={styles.actionButtons}>
          <TouchableOpacity style={styles.cancelButton} onPress={() => navigation.goBack()}>
            <Text style={styles.cancelButtonText}>Annuler</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.saveButton, saving && styles.disabledButton]}
            onPress={saveHistory}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="checkmark" size={20} color="#FFFFFF" />
                <Text style={styles.saveButtonText}>Enregistrer</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#c1dbb0",
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
  scrollContent: {
    paddingBottom: 20,
  },
  treeInfoSection: {
    backgroundColor: "#96c06e",
    margin: 16,
    padding: 16,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: "#00C853",
  },
  treeInfoTitle: {
    fontSize: 14,
    color: "#999999",
    marginBottom: 4,
  },
  treeInfoName: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#FFFFFF",
    marginBottom: 4,
  },
  treeInfoId: {
    fontSize: 12,
    color: "#FFFFFF",
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
  },
  section: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#333",
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#FFFFFF",
    marginBottom: 16,
  },
  dateButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#96c06e",
    borderRadius: 8,
    padding: 12,
  },
  dateText: {
    flex: 1,
    color: "#FFFFFF",
    fontSize: 16,
    marginLeft: 12,
    textTransform: "capitalize",
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    color: "#999999",
    marginBottom: 8,
  },
  input: {
    backgroundColor: "#96c06e",
    borderRadius: 8,
    padding: 12,
    color: "#FFFFFF",
    fontSize: 16,
    borderWidth: 1,
    borderColor: "transparent",
  },
  inputError: {
    borderColor: "#FF5252",
  },
  inputErrorText: {
    color: "#FF5252",
    fontSize: 12,
    marginTop: 4,
  },
  pickerContainer: {
    backgroundColor: "#96c06e",
    borderRadius: 8,
    overflow: "hidden",
  },
  picker: {
    color: "#FFFFFF",
    backgroundColor: "#96c06e",
    height: 50,
  },
  textArea: {
    backgroundColor: "#96c06e",
    borderRadius: 8,
    padding: 12,
    color: "#FFFFFF",
    fontSize: 16,
    height: 100,
    textAlignVertical: "top",
  },
  photoButtons: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: 16,
  },
  photoButton: {
    backgroundColor: "#00C853",
    borderRadius: 8,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    width: "45%",
  },
  photoButtonText: {
    color: "#FFFFFF",
    marginLeft: 8,
    fontSize: 16,
    fontWeight: "500",
  },
  imagePreviewContainer: {
    marginTop: 8,
  },
  imageCountText: {
    color: "#00C853",
    fontSize: 14,
    fontWeight: "500",
    marginBottom: 12,
  },
  imagePreview: {
    width: "100%",
    height: 200,
    marginBottom: 10,
    position: "relative",
    borderRadius: 8,
    overflow: "hidden",
  },
  previewImage: {
    width: "100%",
    height: "100%",
  },
  removeImageButton: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    borderRadius: 12,
  },
  actionButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 20,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: "#96c06e",
    borderRadius: 8,
    padding: 12,
    marginRight: 8,
    alignItems: "center",
  },
  cancelButtonText: {
    color: "#FFFFFF",
    fontWeight: "500",
    fontSize: 16,
  },
  saveButton: {
    flex: 1,
    backgroundColor: "#00C853",
    borderRadius: 8,
    padding: 12,
    marginLeft: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  saveButtonText: {
    color: "#FFFFFF",
    fontWeight: "500",
    fontSize: 16,
    marginLeft: 8,
  },
  disabledButton: {
    opacity: 0.5,
  },
  errorText: {
    color: "#FF5252",
    textAlign: "center",
    margin: 16,
    fontSize: 14,
  },
  offlineBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff9c4",
    padding: 8,
    borderRadius: 8,
    margin: 16,
    marginTop: 0,
  },
  offlineText: {
    marginLeft: 8,
    color: "#000",
    fontWeight: "bold",
    flex: 1,
  },
})

export default AddHistoryScreen