import { Image, StyleSheet, Text, View } from 'react-native';

export function BrandHeader() {
  return (
    <View style={styles.brandLockup}>
      <View style={styles.brandLogoFrame}>
        <Image
          source={require('../assets/icon.png')}
          style={styles.brandLogo}
          resizeMode="contain"
        />
      </View>
      <View style={styles.brandText}>
        <Text style={styles.brandName}>Distribio</Text>
        <Text style={styles.brandSubtitle}>COLLECTOR</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  brandLockup: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  brandLogoFrame: {
    alignItems: 'center',
    backgroundColor: '#EAF4FE',
    borderColor: '#D8E7F5',
    borderRadius: 22,
    borderWidth: 1,
    height: 44,
    justifyContent: 'center',
    overflow: 'hidden',
    padding: 7,
    width: 44,
  },
  brandLogo: {
    borderRadius: 15,
    height: 30,
    width: 30,
  },
  brandName: {
    color: '#020617',
    fontSize: 18,
    fontWeight: '900',
  },
  brandSubtitle: {
    color: '#0369a1',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 2.2,
    marginTop: 2,
  },
  brandText: {
    marginLeft: 10,
  },
});
