import { View, Text, StyleSheet, ScrollView, Platform } from 'react-native';

export default function HelpScreen() {
  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Aide</Text>
      </View>
      <View style={styles.content}>
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Foire aux questions (FAQ)</Text>
          <Text style={styles.question}>Comment signaler un problème ?</Text>
          <Text style={styles.answer}>
            Allez dans l’onglet "Signalements", sélectionnez un emplacement sur la carte, et remplissez le formulaire.
          </Text>

          <Text style={styles.question}>Comment poster un message dans le forum ?</Text>
          <Text style={styles.answer}>
            Allez dans l’onglet "Communauté", et utilisez le formulaire pour poster un message.
          </Text>

          <Text style={styles.question}>Comment modifier mon profil ?</Text>
          <Text style={styles.answer}>
            Allez dans l’onglet "Menu", cliquez sur "Profil", et mettez à jour vos informations.
          </Text>
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
    ...(Platform.OS === 'web'
      ? {
          boxShadow: '0px 2px 3px rgba(0, 0, 0, 0.1)',
        }
      : {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 3,
          elevation: 3,
        }),
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 15,
  },
  question: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 5,
  },
  answer: {
    fontSize: 16,
    color: '#666',
    marginBottom: 15,
  },
});