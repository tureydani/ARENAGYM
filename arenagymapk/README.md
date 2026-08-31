# Arena Gym App (arenagymapk)

App móvil Flutter para clientes del gimnasio: login, membresía activa,
asistencias y notificaciones. Consume la API en `frontend-gym` (rutas
`/api/cliente/*`), no accede a la base de datos directamente.

## Configuración de entorno

La URL base de la API vive en un solo lugar: `lib/config/api_config.dart`.
Por defecto apunta a producción (Vercel). Para desarrollo local contra
`frontend-gym` corriendo en esta PC:

- Desde un **emulador Android**: usa `http://10.0.2.2:3001/api/cliente`
  (así es como el emulador ve el `localhost` de la PC host).
- Desde un **dispositivo físico** en la misma red: usa la IP LAN de tu PC,
  por ejemplo `http://192.168.x.x:3001/api/cliente`.

Cambia el enum `ApiEnvironment` en ese archivo según dónde estés probando.

## Correr / compilar

```bash
flutter pub get
flutter run                 # modo desarrollo
flutter build apk --debug   # APK de prueba
flutter build apk --release # APK de release (requiere firma)
```

## Nota sobre antivirus y build de Android (Gradle)

Si `flutter build apk` falla con `PKIX path building failed` al descargar
dependencias de Gradle, es porque tu antivirus (Avast y similares) intercepta
el tráfico HTTPS con su propio certificado raíz, y la JVM de Gradle no confía
en él (aunque Node/npm sí, porque leen `NODE_EXTRA_CA_CERTS`).

Solución: importa el certificado raíz de tu antivirus al truststore del JDK
que usa Flutter, y apunta Gradle a esa copia **en tu configuración global de
Gradle** (`C:\Users\<tu-usuario>\.gradle\gradle.properties`), NO en el
`android/gradle.properties` de este proyecto — ese archivo sí se sube al
repo y las rutas son específicas de cada máquina.

```properties
# C:\Users\<tu-usuario>\.gradle\gradle.properties
org.gradle.jvmargs=-Xmx8G ... -Djavax.net.ssl.trustStore=C:\\ruta\\a\\tu\\cacerts -Djavax.net.ssl.trustStorePassword=changeit
org.gradle.java.home=C:\\ruta\\a\\tu\\jdk-17
```

Alternativa más simple: desactiva temporalmente el escaneo HTTPS del
antivirus mientras compilas.
