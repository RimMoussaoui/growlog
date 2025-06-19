"use client"

import { useState } from "react"
import { View, Text, TouchableOpacity, Modal, StyleSheet, FlatList } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { ROLES, getRoleDisplayName } from "../services/permissions"

const RoleSelector = ({ currentRole, userRole, onRoleChange, disabled = false }) => {
  const [modalVisible, setModalVisible] = useState(false)

  // Obtenir les rôles disponibles que l'utilisateur peut assigner
  const getAvailableRoles = () => {
    const roles = []

    // Un propriétaire peut assigner seulement le rôle collaborateur
    if (userRole === "owner") {
      roles.push({ key: "collaborator", name: ROLES.collaborator.name })
    }

    return roles
  }

  const availableRoles = getAvailableRoles()

  const handleRoleSelect = (roleKey) => {
    setModalVisible(false)
    if (onRoleChange && roleKey !== currentRole) {
      onRoleChange(roleKey)
    }
  }

  const renderRoleItem = ({ item }) => (
    <TouchableOpacity
      style={[styles.roleItem, item.key === currentRole && styles.roleItemSelected]}
      onPress={() => handleRoleSelect(item.key)}
    >
      <Text style={[styles.roleText, item.key === currentRole && styles.roleTextSelected]}>{item.name}</Text>
      {item.key === currentRole && <Ionicons name="checkmark" size={20} color="#00C853" />}
    </TouchableOpacity>
  )

  if (disabled || availableRoles.length === 0) {
    return (
      <View style={styles.disabledContainer}>
        <Text style={styles.disabledText}>{getRoleDisplayName(currentRole)}</Text>
      </View>
    )
  }

  return (
    <View>
      <TouchableOpacity style={styles.selectorButton} onPress={() => setModalVisible(true)}>
        <Text style={styles.selectorText}>{getRoleDisplayName(currentRole)}</Text>
        <Ionicons name="chevron-down" size={16} color="#AAAAAA" />
      </TouchableOpacity>

      <Modal
        visible={modalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setModalVisible(false)}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Changer le rôle</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            <FlatList
              data={availableRoles}
              renderItem={renderRoleItem}
              keyExtractor={(item) => item.key}
              style={styles.rolesList}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  selectorButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#444",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
  },
  selectorText: {
    color: "#FFFFFF",
    fontSize: 12,
    marginRight: 4,
  },
  disabledContainer: {
    backgroundColor: "#555",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
  },
  disabledText: {
    color: "#AAAAAA",
    fontSize: 12,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    backgroundColor: "#222",
    borderRadius: 12,
    width: "80%",
    maxWidth: 300,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#333",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#FFFFFF",
  },
  rolesList: {
    maxHeight: 200,
  },
  roleItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#333",
  },
  roleItemSelected: {
    backgroundColor: "#333",
  },
  roleText: {
    fontSize: 16,
    color: "#FFFFFF",
  },
  roleTextSelected: {
    color: "#00C853",
    fontWeight: "bold",
  },
})

export default RoleSelector
