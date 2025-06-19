// Définition des permissions
export const PERMISSIONS = {
  // Permissions pour les membres
  INVITE_MEMBERS: "invite_members",
  REMOVE_MEMBERS: "remove_members",
  CHANGE_MEMBER_ROLE: "change_member_role",

  // Permissions pour les arbres
  ADD_TREES: "add_trees",
  EDIT_TREES: "edit_trees",
  DELETE_TREES: "delete_trees",

  // Permissions pour le projet
  EDIT_PROJECT: "edit_project",
  DELETE_PROJECT: "delete_project",

  // Permissions pour l'historique
  ADD_HISTORY: "add_history",
  EDIT_HISTORY: "edit_history",
  DELETE_HISTORY: "delete_history",
}

// Définition des rôles et leurs permissions
export const ROLES = {
  owner: {
    name: "Propriétaire",
    permissions: Object.values(PERMISSIONS), // Toutes les permissions
  },
  collaborator: {
    name: "Collaborateur",
    permissions: [
      PERMISSIONS.ADD_TREES,
      PERMISSIONS.EDIT_TREES,
      PERMISSIONS.DELETE_TREES,
      PERMISSIONS.ADD_HISTORY,
      PERMISSIONS.EDIT_HISTORY,
      PERMISSIONS.DELETE_HISTORY,
      PERMISSIONS.EDIT_PROJECT,
    ],
  },
}

/**
 * Obtient le rôle d'un utilisateur dans un projet
 */
export const getUserRole = (user, project, members = []) => {
  if (!user || !project) return null

  // Vérifier si l'utilisateur est le propriétaire du projet
  if (project.owner === user._id || project.createdBy === user._id) {
    return "owner"
  }

  // Chercher le rôle dans la liste des membres
  const member = members.find((member) => member._id === user._id || member.userId === user._id)
  if (member && member.role) {
    return member.role
  }

  // Par défaut, si l'utilisateur est membre mais sans rôle spécifique
  if (members.some((member) => member._id === user._id || member.userId === user._id)) {
    return "collaborator"
  }

  // L'utilisateur n'est pas membre du projet
  return null
}

/**
 * Vérifie si un rôle a une permission spécifique
 */
export const hasPermission = (userRole, permission) => {
  if (!userRole || !permission) return false

  const role = ROLES[userRole]
  if (!role) return false

  return role.permissions.includes(permission)
}

/**
 * Obtient toutes les permissions d'un rôle
 */
export const getRolePermissions = (roleName) => {
  const role = ROLES[roleName]
  return role ? role.permissions : []
}

/**
 * Obtient le nom d'affichage d'un rôle
 */
export const getRoleDisplayName = (roleName) => {
  const role = ROLES[roleName]
  return role ? role.name : roleName
}

/**
 * Obtient tous les rôles disponibles
 */
export const getAvailableRoles = () => {
  return Object.keys(ROLES).map((key) => ({
    key,
    name: ROLES[key].name,
    permissions: ROLES[key].permissions,
  }))
}

/**
 * Vérifie si un utilisateur peut effectuer une action sur un projet
 */
export const canUserPerformAction = (user, project, members, permission) => {
  const userRole = getUserRole(user, project, members)
  return hasPermission(userRole, permission)
}
