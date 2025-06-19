import { View, Text, StyleSheet } from "react-native"
import { hasPermission, hasPermissions } from "../services/permissions"

/**
 * Composant pour protéger l'affichage basé sur les permissions
 */
const PermissionGuard = ({
  userRole,
  permission,
  permissions,
  requireAll = true,
  children,
  fallback = null,
  showFallback = false,
}) => {
  let hasAccess = false

  if (permission) {
    hasAccess = hasPermission(userRole, permission)
  } else if (permissions && permissions.length > 0) {
    hasAccess = hasPermissions(userRole, permissions, requireAll)
  }

  if (hasAccess) {
    return children
  }

  if (showFallback && fallback) {
    return fallback
  }

  if (showFallback) {
    return (
      <View style={styles.noPermissionContainer}>
        <Text style={styles.noPermissionText}>Vous n'avez pas les permissions nécessaires pour cette action</Text>
      </View>
    )
  }

  return null
}

const styles = StyleSheet.create({
  noPermissionContainer: {
    padding: 16,
    backgroundColor: "#333",
    borderRadius: 8,
    margin: 8,
  },
  noPermissionText: {
    color: "#AAAAAA",
    textAlign: "center",
    fontStyle: "italic",
  },
})

export default PermissionGuard
