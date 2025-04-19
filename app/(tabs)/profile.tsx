import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Pressable, Image, ActivityIndicator } from 'react-native';
import { useAuth } from '@/hooks/useAuth';
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { router } from 'expo-router';
import { Camera } from 'lucide-react-native';
import imageCompression from 'browser-image-compression';

export default function ProfileScreen() {
  const { user, loading: authLoading } = useAuth();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [phoneDigits, setPhoneDigits] = useState('');
  const [formattedPhone, setFormattedPhone] = useState('');
  const [photoUrl, setPhotoUrl] = useState(null);
  const [previewImage, setPreviewImage] = useState(null);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [forceRender, setForceRender] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [phoneError, setPhoneError] = useState('');
  const [nameError, setNameError] = useState('');
  const [hasInteractedWithName, setHasInteractedWithName] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!authLoading && !user) {
      console.log('Utilisateur non authentifié, redirection vers la page de connexion');
      router.replace('/login');
    }
  }, [user, authLoading]);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) {
        console.error('Utilisateur non authentifié');
        return;
      }

      const { data, error } = await supabase
        .from('users')
        .select('name, phone, photo_url')
        .eq('id', user.id)
        .single();

      if (error) {
        if (error.message.includes('The result contains 0 rows')) {
          const { error: insertError } = await supabase
            .from('users')
            .insert({
              id: user.id,
              email: user.email,
              name: '',
              phone: '',
              photo_url: null,
            });

          if (insertError) {
            console.error('Erreur lors de la création de l\'entrée utilisateur:', insertError);
            alert('Erreur lors de la création du profil : ' + insertError.message);
            return;
          }

          setName('');
          setPhone('');
          setPhoneDigits('');
          setFormattedPhone('');
          setPhotoUrl(null);
          setHasInteractedWithName(false);
        } else {
          console.error('Erreur lors du chargement du profil :', error);
          alert('Erreur lors du chargement du profil : ' + error.message);
          return;
        }
      } else {
        setName(data.name || '');
        if (data.phone) {
          const digits = data.phone.replace(/[^0-9]/g, '');
          setPhoneDigits(digits);
          const formatted = formatPhoneNumberDisplay(digits);
          setFormattedPhone(formatted);
          setPhone(formatted);
        }
        setPhotoUrl(data.photo_url || null);
        if (data.name) {
          validateName(data.name);
          setHasInteractedWithName(true);
        }
      }
    };

    if (!authLoading && user) {
      fetchProfile();
    }
  }, [user, authLoading]);

  const validateName = (text) => {
    if (!text.trim()) {
      setNameError('Le nom est requis.');
      return false;
    }

    const letterCount = (text.match(/[a-zA-Z]/g) || []).length;
    const digitCount = (text.match(/[0-9]/g) || []).length;
    const totalLength = text.length;

    if (totalLength < 3 || totalLength > 15) {
      setNameError('Le nom doit contenir entre 3 et 15 caractères.');
      return false;
    }
    if (letterCount > 15) {
      setNameError('Le nom peut contenir maximum 15 lettres.');
      return false;
    }
    if (digitCount > 3) {
      setNameError('Le nom peut contenir maximum 3 chiffres.');
      return false;
    }
    if (!/^[a-zA-Z0-9\s-_]*$/.test(text)) {
      setNameError('Seules les lettres, chiffres, espaces, tirets et underscores sont autorisés.');
      return false;
    }

    setNameError('');
    return true;
  };

  const handleNameChange = (text) => {
    setName(text);
    setHasInteractedWithName(true);
    if (text.trim()) {
      validateName(text);
    } else {
      setNameError('');
    }
  };

  const formatPhoneNumberDisplay = (digits) => {
    if (!digits) return '';
    let formatted = '';
    for (let i = 0; i < digits.length; i++) {
      if (i === 2 || i === 5 || i === 7) formatted += ' ';
      formatted += digits[i];
    }
    return formatted;
  };

  const handlePhoneChange = (text) => {
    console.log('handlePhoneChange called with text:', text);
    const digits = text.replace(/[^0-9]/g, '');
    console.log('Extracted digits:', digits);
    if (digits.length > 9) {
      console.log('Digits length > 9, returning');
      return;
    }

    setPhoneDigits(digits);
    setPhone(digits);
    console.log('Updated phone state:', digits);
    const formatted = formatPhoneNumberDisplay(digits);
    setFormattedPhone(formatted);
    console.log('Formatted phone:', formatted);

    if (digits.length === 9) {
      const phoneRegex = /^\d{2}\s\d{3}\s\d{2}\s\d{2}$/;
      const validPrefixes = ['75', '76', '77', '78'];
      const prefix = digits.substring(0, 2);
      if (!validPrefixes.includes(prefix)) {
        setPhoneError('Le numéro doit commencer par 75, 76, 77 ou 78.');
        console.log('Validation failed: Invalid prefix');
        return;
      }
      if (!phoneRegex.test(formatted)) {
        setPhoneError('Le numéro doit être au format xx xxx xx xx (9 chiffres)');
        console.log('Validation failed, setting error');
      } else {
        setPhoneError('');
        console.log('Validation passed, clearing error');
      }
    } else {
      setPhoneError('');
      console.log('Digits length < 9, clearing error');
    }
  };

  const pickImage = async () => {
    if (!user) {
      alert('Vous devez être connecté pour ajouter une photo.');
      return;
    }

    setIsLoading(true);
    try {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = async (event) => {
        const file = event.target.files[0];
        if (!file) {
          setIsLoading(false);
          return;
        }

        if (!file.type.startsWith('image/')) {
          alert('Veuillez sélectionner une image valide (JPEG, PNG, etc.).');
          setIsLoading(false);
          return;
        }

        const previewUri = URL.createObjectURL(file);
        setPreviewImage(previewUri);
        setIsLoading(false);
      };
      input.click();
    } catch (error) {
      console.error('Erreur lors de la sélection ou du téléversement de l\'image :', error);
      alert('Erreur lors de la sélection de l\'image : ' + error.message);
      setIsLoading(false);
    }
  };

  const cancelImageSelection = () => {
    setPreviewImage(null);
  };

  const uploadProfilePicture = async (userId, file) => {
    try {
      console.log('Début du téléversement de la photo pour userId:', userId);
      console.log('Photo actuelle (photoUrl):', photoUrl);

      if (photoUrl) {
        const fileName = photoUrl.split('/').pop().split('?')[0];
        console.log('Suppression de l\'ancienne photo:', fileName);
        const { error: deleteError } = await supabase.storage
          .from('profile-pictures')
          .remove([fileName]);
        if (deleteError) {
          console.error('Erreur lors de la suppression de l\'ancienne photo :', deleteError);
          throw new Error('Échec de la suppression de l\'ancienne photo : ' + deleteError.message);
        }
        console.log('Ancienne photo supprimée avec succès');
      }

      const fileName = `${userId}.jpeg`;
      console.log('Téléversement de la nouvelle photo:', fileName);
      const { error: uploadError } = await supabase.storage
        .from('profile-pictures')
        .upload(fileName, file, {
          cacheControl: '3600',
          contentType: 'image/jpeg',
          upsert: true,
        });

      if (uploadError) {
        console.error('Erreur lors du téléversement de la photo :', uploadError);
        throw new Error('Échec du téléversement de la photo : ' + uploadError.message);
      }
      console.log('Photo téléversée avec succès');

      const timestamp = new Date().getTime();
      const { data: publicUrlData } = supabase.storage
        .from('profile-pictures')
        .getPublicUrl(fileName);
      const cacheBustedUrl = `${publicUrlData.publicUrl}?t=${timestamp}`;
      console.log('URL publique de la photo avec cache-busting:', cacheBustedUrl);

      return cacheBustedUrl;
    } catch (error) {
      console.error('Erreur lors du téléversement de la photo :', error);
      throw error;
    }
  };

  const handleUpdateProfile = async () => {
    if (!user) {
      alert('Vous devez être connecté pour mettre à jour votre profil.');
      return;
    }

    if (!validateName(name)) {
      return;
    }

    if (phoneDigits) {
      const phoneRegex = /^\d{2}\s\d{3}\s\d{2}\s\d{2}$/;
      const validPrefixes = ['75', '76', '77', '78'];
      const prefix = phoneDigits.substring(0, 2);
      if (!validPrefixes.includes(prefix)) {
        setPhoneError('Le numéro doit commencer par 75, 76, 77 ou 78.');
        return;
      }
      if (!phoneRegex.test(formattedPhone)) {
        setPhoneError('Le numéro doit être au format xx xxx xx xx (9 chiffres)');
        return;
      }
    }

    setIsLoading(true);
    try {
      let finalPhotoUrl = photoUrl;
      if (previewImage) {
        const file = await fetch(previewImage).then((res) => res.blob());
        const options = {
          maxSizeMB: 1,
          maxWidthOrHeight: 800,
          useWebWorker: true,
        };
        const compressedFile = await imageCompression(file, options);
        finalPhotoUrl = await uploadProfilePicture(user.id, compressedFile);
        setPhotoUrl(finalPhotoUrl);
        setPreviewImage(null);
      }

      const { data, error: dbError } = await supabase
        .from('users')
        .upsert(
          {
            id: user.id,
            email: user.email,
            name: name,
            phone: formattedPhone,
            photo_url: finalPhotoUrl,
          },
          { onConflict: 'id' }
        );

      if (dbError) {
        console.error('Erreur lors de la mise à jour de la table users:', dbError);
        throw dbError;
      }

      if (formattedPhone) {
        setPhone(formattedPhone);
      }

      setShowSuccessMessage(true);
      setForceRender(true);
    } catch (error) {
      console.error('Erreur générale lors de la mise à jour du profil:', error);
      alert('Erreur lors de la mise à jour du profil : ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCloseMessage = () => {
    setShowSuccessMessage(false);
    setForceRender(false);
    router.replace('/(tabs)/menu'); // Redirection vers menu au lieu de map
  };

  if (authLoading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#1a73e8" />
      </View>
    );
  }

  return (
    <View style={styles.container} key={forceRender ? 'force-render' : 'normal'}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.title}>Profil</Text>
        </View>
        <View style={styles.content}>
          <View style={styles.card}>
            <View style={styles.photoContainer}>
              {isLoading ? (
                <View style={styles.photoPlaceholder}>
                  <ActivityIndicator size="large" color="#1a73e8" />
                </View>
              ) : previewImage ? (
                <>
                  <Image source={{ uri: previewImage }} style={styles.photo} />
                  <View style={styles.photoButtonContainer}>
                    <TouchableOpacity style={styles.photoButton} onPress={pickImage} disabled={isLoading}>
                      <Text style={styles.photoButtonText}>Changer la photo</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.cancelButton} onPress={cancelImageSelection}>
                      <Text style={styles.cancelButtonText}>Annuler</Text>
                    </TouchableOpacity>
                  </View>
                </>
              ) : photoUrl ? (
                <>
                  <Image source={{ uri: photoUrl }} style={styles.photo} />
                  <TouchableOpacity style={styles.photoButton} onPress={pickImage} disabled={isLoading}>
                    <Text style={styles.photoButtonText}>Modifier la photo</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <View style={styles.photoPlaceholder}>
                    <Camera size={40} color="#666" />
                  </View>
                  <TouchableOpacity style={styles.photoButton} onPress={pickImage} disabled={isLoading}>
                    <Text style={styles.photoButtonText}>Ajouter une photo</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>

            <Text style={styles.label}>Email</Text>
            <Text style={styles.info}>{user?.email}</Text>

            <Text style={styles.label}>Nom</Text>
            <TextInput
              style={[styles.input, nameError ? styles.inputError : null]}
              value={name}
              onChangeText={handleNameChange}
              placeholder="Entrez votre nom"
              maxLength={15}
            />
            {nameError && hasInteractedWithName ? <Text style={styles.errorText}>{nameError}</Text> : null}

            <Text style={styles.label}>Téléphone</Text>
            <TextInput
              style={[styles.input, phoneError ? styles.inputError : null]}
              value={phone}
              onChangeText={handlePhoneChange}
              placeholder="xxxxxxxxx"
              keyboardType="phone-pad"
              maxLength={11}
            />
            {phoneError ? <Text style={styles.errorText}>{phoneError}</Text> : null}

            <TouchableOpacity
              style={[styles.button, isLoading ? styles.buttonDisabled : null]}
              onPress={handleUpdateProfile}
              disabled={isLoading || !!phoneError || (hasInteractedWithName && !!nameError)}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Mettre à jour le profil</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {showSuccessMessage && (
        <View style={styles.messageOverlay}>
          <View style={styles.messageContent}>
            <Text style={styles.messageText}>Profil mis à jour avec succès</Text>
            <Pressable style={styles.messageButton} onPress={handleCloseMessage}>
              <Text style={styles.messageButtonText}>OK</Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    width: '100%',
    height: '100%',
  },
  scrollContent: {
    flexGrow: 1,
  },
  header: {
    padding: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    width: '100%',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1a1a1a',
  },
  content: {
    flex: 1,
    padding: 20,
    width: '100%',
  },
  card: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    width: '100%',
  },
  photoContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  photo: {
    width: 120,
    height: 120,
    borderRadius: 60,
    marginBottom: 10,
  },
  photoPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  photoButtonContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
  },
  photoButton: {
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
  },
  photoButtonText: {
    color: '#1a73e8',
    fontSize: 14,
    fontWeight: '500',
  },
  cancelButton: {
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
  },
  cancelButtonText: {
    color: '#ff0000',
    fontSize: 14,
    fontWeight: '500',
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 5,
  },
  info: {
    fontSize: 16,
    color: '#666',
    marginBottom: 15,
  },
  input: {
    borderWidth: 1,
    borderColor: '#eee',
    borderRadius: 8,
    padding: 10,
    fontSize: 16,
    marginBottom: 15,
    width: '100%',
  },
  inputError: {
    borderColor: '#ff0000',
  },
  errorText: {
    color: '#ff0000',
    fontSize: 14,
    marginBottom: 15,
  },
  button: {
    backgroundColor: '#1a73e8',
    borderRadius: 8,
    padding: 15,
    alignItems: 'center',
    width: '100%',
  },
  buttonDisabled: {
    backgroundColor: '#a1c2f7',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  messageOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  messageContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    width: '80%',
    maxWidth: 400,
  },
  messageText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 20,
    textAlign: 'center',
  },
  messageButton: {
    backgroundColor: '#1a73e8',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  messageButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});