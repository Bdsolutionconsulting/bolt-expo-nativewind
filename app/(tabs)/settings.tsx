import { View, Text, StyleSheet, ScrollView, Switch, TouchableOpacity } from 'react-native';
import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import Select from 'react-select';

// Options pour le menu déroulant (sans "Satellite")
const mapStyleOptions = [
  { value: 'streets-v2', label: 'Rues (par défaut)' },
  { value: 'basic-v2', label: 'Basique' },
  { value: 'pastel', label: 'Pastel' },
];

export default function SettingsScreen() {
  const [notificationsEnabled, setNotificationsEnabled] = useState(true); // Activé par défaut
  const [mapStyle, setMapStyle] = useState('streets-v2'); // Style par défaut

  // Charger les paramètres depuis AsyncStorage au démarrage
  useEffect(() => {
    const loadSettings = async () => {
      try {
        // Charger l'état des notifications
        const storedNotifications = await AsyncStorage.getItem('notificationsEnabled');
        if (storedNotifications !== null) {
          setNotificationsEnabled(JSON.parse(storedNotifications));
        } else {
          // Si aucune valeur n'est stockée, sauvegarder la valeur par défaut (true)
          await AsyncStorage.setItem('notificationsEnabled', JSON.stringify(true));
        }

        // Charger le style de carte
        const storedStyle = await AsyncStorage.getItem('mapStyle');
        if (storedStyle) {
          setMapStyle(storedStyle);
        }
      } catch (error) {
        console.error('Erreur lors du chargement des paramètres :', error);
      }
    };

    loadSettings();
  }, []);

  // Sauvegarder l'état des notifications dans AsyncStorage
  const handleNotificationsChange = async (value) => {
    try {
      setNotificationsEnabled(value);
      await AsyncStorage.setItem('notificationsEnabled', JSON.stringify(value));
    } catch (error) {
      console.error('Erreur lors de la sauvegarde des notifications :', error);
    }
  };

  // Sauvegarder le style de carte et rediriger vers la carte avec un paramètre de rafraîchissement
  const handleSaveMapStyle = async () => {
    try {
      await AsyncStorage.setItem('mapStyle', mapStyle);
      router.push('/map?refresh=true'); // Ajouter un paramètre pour forcer le rafraîchissement
    } catch (error) {
      console.error('Erreur lors de la sauvegarde du style de carte :', error);
    }
  };

  // Styles personnalisés pour react-select
  const customStyles = {
    control: (provided) => ({
      ...provided,
      width: 150,
      borderRadius: 4,
      borderColor: '#ddd',
      backgroundColor: '#fff',
      padding: 2,
      boxShadow: 'none',
      cursor: 'pointer',
    }),
    option: (provided, state) => ({
      ...provided,
      backgroundColor: state.isSelected ? '#2563eb' : state.isFocused ? '#f0f0f0' : '#fff',
      color: state.isSelected ? '#fff' : '#1a1a1a',
      padding: 8,
      cursor: 'pointer',
    }),
    singleValue: (provided) => ({
      ...provided,
      color: '#1a1a1a',
    }),
    menu: (provided) => ({
      ...provided,
      width: 150,
      borderRadius: 4,
      marginTop: 2,
    }),
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Paramètres</Text>
      </View>
      <View style={styles.content}>
        {/* Bloc pour Activer les notifications */}
        <View style={styles.card}>
          <View style={styles.settingItem}>
            <Text style={styles.label}>Activer les notifications par email</Text>
            <Switch
              value={notificationsEnabled}
              onValueChange={handleNotificationsChange}
            />
          </View>
        </View>

        {/* Bloc pour Style de carte */}
        <View style={styles.card}>
          <Text style={styles.label}>Style de carte</Text>
          <Select
            options={mapStyleOptions}
            value={mapStyleOptions.find(option => option.value === mapStyle)}
            onChange={(option) => setMapStyle(option.value)}
            styles={customStyles}
            isSearchable={false}
          />
          <TouchableOpacity style={styles.saveButton} onPress={handleSaveMapStyle}>
            <Text style={styles.saveButtonText}>Valider</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    padding: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1a1a1a',
  },
  content: {
    padding: 20,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    boxShadow: '0px 2px 3px rgba(0, 0, 0, 0.1)',
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
  label: {
    fontSize: 16,
    color: '#1a1a1a',
    marginBottom: 10,
  },
  saveButton: {
    backgroundColor: '#2563eb',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignSelf: 'center',
    marginTop: 20,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
});