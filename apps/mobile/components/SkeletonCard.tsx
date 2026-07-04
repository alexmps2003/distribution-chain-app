import { StyleSheet, View } from 'react-native';

type SkeletonCardProps = {
  rows?: number;
};

export function SkeletonCard({ rows = 3 }: SkeletonCardProps) {
  return (
    <View style={styles.card}>
      {Array.from({ length: rows }).map((_, index) => (
        <View
          key={index}
          style={[
            styles.bar,
            index === 0 ? styles.titleBar : null,
            index === rows - 1 ? styles.shortBar : null,
          ]}
        />
      ))}
    </View>
  );
}

export function SkeletonCardList({
  count = 3,
  rows = 3,
}: {
  count?: number;
  rows?: number;
}) {
  return (
    <>
      {Array.from({ length: count }).map((_, index) => (
        <SkeletonCard key={index} rows={rows} />
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: '#e2e8f0',
    borderRadius: 999,
    height: 14,
    marginTop: 12,
    width: '78%',
  },
  card: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 16,
    padding: 18,
  },
  shortBar: {
    width: '44%',
  },
  titleBar: {
    height: 18,
    marginTop: 0,
    width: '58%',
  },
});
