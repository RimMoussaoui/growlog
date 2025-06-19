/**
 * Données de démonstration pour l'application
 */

// Profil utilisateur de démonstration
export const demoProfile = {
  _id: "demo_user_id",
  name: "Utilisateur Démo",
  email: "demo@example.com",
  role: "user",
  createdAt: "2023-01-01T00:00:00.000Z",
  _demo: true,
}

// Projets de démonstration
export const demoProjects = [
  {
    _id: "demo_project_1",
    name: "Oliveraie de Montpellier",
    description: "Projet de plantation d'oliviers dans la région de Montpellier",
    location: {
      lat: 43.6112,
      lng: 3.8767,
      name: "Montpellier",
    },
    owner: "demo_user_id",
    members: ["demo_user_id"],
    createdAt: "2023-01-15T00:00:00.000Z",
    _demo: true,
  },
  {
    _id: "demo_project_2",
    name: "Oliveraie de Nîmes",
    description: "Restauration d'une oliveraie abandonnée près de Nîmes",
    location: {
      lat: 43.8367,
      lng: 4.3601,
      name: "Nîmes",
    },
    owner: "demo_user_id",
    members: ["demo_user_id"],
    createdAt: "2023-02-10T00:00:00.000Z",
    _demo: true,
  },
]

// Arbres de démonstration
export const demoTrees = [
  {
    _id: "demo_tree_1",
    name: "Olivier Centenaire",
    species: "Olea europaea",
    description: "Olivier centenaire en bonne santé",
    height: 5.2,
    diameter: 45,
    health: "good",
    location: {
      lat: 43.6115,
      lng: 3.877,
      name: "Parcelle Nord",
    },
    projectId: "demo_project_1",
    plantingDate: "1923-03-15T00:00:00.000Z",
    addedBy: "demo_user_id",
    createdAt: "2023-01-20T00:00:00.000Z",
    _demo: true,
  },
  {
    _id: "demo_tree_2",
    name: "Jeune Olivier",
    species: "Olea europaea",
    description: "Jeune olivier planté récemment",
    height: 2.1,
    diameter: 15,
    health: "good",
    location: {
      lat: 43.612,
      lng: 3.8775,
      name: "Parcelle Est",
    },
    projectId: "demo_project_1",
    plantingDate: "2022-11-10T00:00:00.000Z",
    addedBy: "demo_user_id",
    createdAt: "2023-01-25T00:00:00.000Z",
    _demo: true,
  },
  {
    _id: "demo_tree_3",
    name: "Olivier Malade",
    species: "Olea europaea",
    description: "Olivier présentant des signes de maladie",
    height: 4.5,
    diameter: 30,
    health: "poor",
    location: {
      lat: 43.837,
      lng: 4.3605,
      name: "Zone Sud",
    },
    projectId: "demo_project_2",
    plantingDate: "1980-05-20T00:00:00.000Z",
    addedBy: "demo_user_id",
    createdAt: "2023-02-15T00:00:00.000Z",
    _demo: true,
  },
]

// Historique des arbres de démonstration
export const demoTreeHistory = {
  demo_tree_1: {
    2023: {
      _id: "demo_history_1_2023",
      treeId: "demo_tree_1",
      type: "Taille",
      date: "2023-02-15T00:00:00.000Z",
      notes: "Taille d'entretien annuelle",
      recordedBy: "demo_user_id",
      year: "2023",
      _demo: true,
    },
    2022: {
      _id: "demo_history_1_2022",
      treeId: "demo_tree_1",
      type: "Traitement",
      date: "2022-06-10T00:00:00.000Z",
      notes: "Traitement préventif contre la mouche de l'olive",
      recordedBy: "demo_user_id",
      year: "2022",
      _demo: true,
    },
  },
  demo_tree_2: {
    2023: {
      _id: "demo_history_2_2023",
      treeId: "demo_tree_2",
      type: "Arrosage",
      date: "2023-07-20T00:00:00.000Z",
      notes: "Arrosage pendant la période de sécheresse",
      recordedBy: "demo_user_id",
      year: "2023",
      _demo: true,
    },
  },
  demo_tree_3: {
    2023: {
      _id: "demo_history_3_2023",
      treeId: "demo_tree_3",
      type: "Traitement",
      date: "2023-04-05T00:00:00.000Z",
      notes: "Traitement contre la verticilliose",
      recordedBy: "demo_user_id",
      year: "2023",
      _demo: true,
    },
    2022: {
      _id: "demo_history_3_2022",
      treeId: "demo_tree_3",
      type: "Diagnostic",
      date: "2022-11-15T00:00:00.000Z",
      notes: "Identification des symptômes de verticilliose",
      recordedBy: "demo_user_id",
      year: "2022",
      _demo: true,
    },
  },
}
