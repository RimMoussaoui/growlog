"use client"

import { useState, useEffect } from "react"
import { View, Text, StyleSheet } from "react-native"

/**
 * Composant qui affiche l'état de la connexion réseau
 */
const NetworkStatus = () => {
  const [isConnected, setIsConnected] = useState(true)

  useEffect(() => {
    // Vérifier l'état de la connexion au démarrage
    checkConnection()

    // Vérifier périodiquement l'état de la connexion
    const interval = setInterval(checkConnection, 10000)

    return () => clearInterval(interval)
  }, [])

  const checkConnection = async () => {
    try {
      // Import dynamique pour éviter les erreurs
      const { isOnline } = await import("../services/network")
      const online = await isOnline()
      setIsConnected(online)
    } catch (error) {
      console.log("[NetworkStatus] Erreur lors de la vérification de la connexion:", error)
      // En cas d'erreur, assumer qu'on est en ligne
      setIsConnected(true)
    }
  }

  if (isConnected) {
    return null
  }

  return (
    <View style={styles.networkIndicator}>
      <Text style={styles.networkIndicatorText}>Mode hors ligne</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  networkIndicator: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: "#FF5252",
    paddingVertical: 5,
    alignItems: "center",
    zIndex: 1000,
  },
  networkIndicatorText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "bold",
  },
})

export default NetworkStatus
