import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Picker, Platform } from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { ChevronLeft } from 'lucide-react-native';

export default function NewPostScreen() {
  const { user } = useAuth();
  const [category, setCategory] = useState('events');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [photo, setPhoto] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const categories = [
    { id: 'events', name: 'Événements et activités' },
    { id: 'reports', name: 'Signalements et améliorations' },
    { id: 'daily', name: 'Vie quotidienne' },
    { id: 'ads', name: 'Petites annonces' },
    { id: 'ideas', name: 'Idées et suggestions' },
  ];

  const handlePhotoChange = async (event) => {
    const file = event.target.files[0];
    if (file) {
      setPhoto(file);
    }
  };

  const handleSubmit = async () => {
    if (!title || !content) {
      setError('Le titre et le contenu sont requis.');
      return;
    }

    setLoading(true);
    setError(null);

    let photoUrl = null;
    if (photo) {
      const fileExt = photo.name.split('.').pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `${user.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('post-photos')
        .upload(filePath, photo);

      if (uploadError) {
        setError('Erreur lors de l’upload de la photo : ' + uploadError.message);
        setLoading(false);
        return;
      }

      const { data: urlData } = supabase.storage.from('post-photos').getPublicUrl(filePath);
      photoUrl = urlData.publicUrl;
    }

    const { error } = await supabase.from('posts').insert({
      user_id: user.id,
      title,
      content,
      category,
      photo_url: photoUrl,
    });

    if (error) {
      setError('Erreur lors de la création du post : ' + error.message);
      setLoading(false);
    } else {
      router.push('/community'); // Redirection vers /community
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerContainer}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ChevronLeft color="#374151" size={24} />
        </TouchableOpacity>
        <Text style={styles.header}>Nouveau post</Text>
      </View>
      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}
      <View style={styles.inputContainer}>
        <Text style={styles.label}>Catégorie</Text>
        <Picker
          selectedValue={category}
          onValueChange={(itemValue) => setCategory(itemValue)}
          style={styles.picker}
        >
          {categories.map((cat) => (
            <Picker.Item key={cat.id} label={cat.name} value={cat.id} />
          ))}
        </Picker>
      </View>
      <View style={styles.inputContainer}>
        <Text style={styles.label}>Titre</Text>
        <TextInput
          style={styles.input}
          placeholder="Titre de votre post"
          value={title}
          onChangeText={setTitle}
        />
      </View>
      <View style={styles.inputContainer}>
        <Text style={styles.label}>Contenu</Text>
        <TextInput
          style={[styles.input, styles.contentInput]}
          placeholder="Écrivez votre message ici..."
          value={content}
          onChangeText={setContent}
          multiline
          numberOfLines={4}
        />
      </View>
      <View style={styles.inputContainer}>
        <Text style={styles.label}>Photo (optionnel)</Text>
        {Platform.OS === 'web' ? (
          <input
            type="file"
            accept="image/*"
            onChange={handlePhotoChange}
            style={{ padding: 10, backgroundColor: '#e5e7eb', borderRadius: 8 }}
          />
        ) : (
          <Text style={styles.uploadMessage}>
            L’upload de photos n’est pas disponible dans WebContainer.
          </Text>
        )}
      </View>
      <TouchableOpacity
        style={[styles.button, loading && styles.buttonDisabled]}
        onPress={handleSubmit}
        disabled={loading}
      >
        <Text style={styles.buttonText}>{loading ? 'Envoi...' : 'Publier'}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 16,
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  header: {
    fontSize: 24,
    fontWeight: 'bold',
    flex: 1,
  },
  errorContainer: {
    backgroundColor: '#fee2e2',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
  },
  errorText: {
    color: '#dc2626',
    fontSize: 14,
    textAlign: 'center',
  },
  inputContainer: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 8,
  },
  picker: {
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  input: {
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    fontSize: 16,
  },
  contentInput: {
    height: 120,
    textAlignVertical: 'top',
  },
  uploadMessage: {
    color: '#6b7280',
    fontSize: 14,
  },
  button: {
    backgroundColor: '#2563eb',
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 16,
  },
  buttonDisabled: {
    backgroundColor: '#93c5fd',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
});