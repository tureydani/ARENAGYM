import 'dart:io';
import 'dart:math' as math;
import 'dart:typed_data';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter_image_compress/flutter_image_compress.dart';
import 'package:image/image.dart' as img;
import 'package:image_picker/image_picker.dart';

import '../../services/pose_analysis_service.dart';
import '../../theme/app_theme.dart';

/// Resultado de una captura aceptada o pendiente de revisión: todo lo que
/// [NuevaEvaluacionScreen] necesita para subir la foto más adelante.
class FotoCapturada {
  final Uint8List bytes;
  final int anchoPx;
  final int altoPx;
  final ResultadoAnalisisFoto analisis;

  FotoCapturada({required this.bytes, required this.anchoPx, required this.altoPx, required this.analisis});
}

String _mensajeMotivo(MotivoRechazoFoto motivo) {
  switch (motivo) {
    case MotivoRechazoFoto.sinPersona:
      return 'No se detectó una persona en la fotografía. Vuelve a intentarlo con el cuerpo completo dentro del encuadre.';
    case MotivoRechazoFoto.cuerpoIncompleto:
      return 'No se distingue suficiente cuerpo en la fotografía. Al menos hombros y cadera deben estar visibles dentro del área indicada; para una medición más precisa, intenta mostrar el cuerpo completo.';
    case MotivoRechazoFoto.posturaInclinada:
      return 'La postura se ve demasiado inclinada. Mantén el cuerpo erguido y la cámara a la misma altura.';
    case MotivoRechazoFoto.confianzaBaja:
      return 'No se pudo identificar la postura con suficiente confianza. Mejora la iluminación y vuelve a intentarlo.';
  }
}

/// Tarjeta de un tipo de fotografía dentro del flujo de "Nueva evaluación
/// física": muestra la guía, permite capturar/volver a capturar y corre el
/// control de calidad + análisis de pose localmente.
class CapturaFotoCard extends StatefulWidget {
  final String tipo;
  final String titulo;
  final String guia;
  final bool opcional;
  final ValueChanged<FotoCapturada?> onCambio;

  const CapturaFotoCard({
    super.key,
    required this.tipo,
    required this.titulo,
    required this.guia,
    required this.onCambio,
    this.opcional = false,
  });

  @override
  State<CapturaFotoCard> createState() => _CapturaFotoCardState();
}

class _CapturaFotoCardState extends State<CapturaFotoCard> {
  bool _procesando = false;
  String? _estadoTexto;
  FotoCapturada? _foto;
  String? _mensajeError;

  Future<void> _capturar(ImageSource origen) async {
    setState(() {
      _procesando = true;
      _mensajeError = null;
      _estadoTexto = 'Preparando fotografía...';
    });

    try {
      final picker = ImagePicker();
      final XFile? archivo = await picker.pickImage(source: origen, imageQuality: 95);
      if (archivo == null) {
        setState(() => _procesando = false);
        return;
      }

      setState(() => _estadoTexto = 'Analizando postura...');

      // Algunos teléfonos guardan la foto con el sensor "acostado" + una
      // bandera EXIF que indica cuánto rotarla para verse en vertical. Si
      // esa bandera se pierde en la compresión (flutter_image_compress no
      // la respeta de forma consistente entre dispositivos), la imagen
      // queda físicamente de costado y el análisis de pose mide hombros
      // casi verticales -> siempre rechaza la foto como "postura
      // inclinada", sin importar cómo se tomó realmente. Por eso se
      // "hornea" la rotación en los píxeles ANTES de comprimir/analizar.
      final rutaOrientada = await _hornearOrientacion(archivo.path);

      final comprimido = await FlutterImageCompress.compressWithFile(
        rutaOrientada,
        minWidth: 1280,
        quality: 85,
        format: CompressFormat.jpeg,
      );
      final bytes = comprimido ?? await File(rutaOrientada).readAsBytes();
      await File(rutaOrientada).delete().catchError((_) => File(rutaOrientada));

      final codec = await ui.instantiateImageCodec(bytes);
      final frame = await codec.getNextFrame();
      final anchoPx = frame.image.width;
      final altoPx = frame.image.height;

      final tempFile = await File(
        '${Directory.systemTemp.path}/seguimiento_${widget.tipo}_${DateTime.now().millisecondsSinceEpoch}.jpg',
      ).create();
      await tempFile.writeAsBytes(bytes);

      setState(() => _estadoTexto = 'Identificando puntos corporales...');
      final resultado = await PoseAnalysisService.instance.analizarFoto(
        tempFile.path,
        anchoPx: anchoPx,
        altoPx: altoPx,
      );
      await tempFile.delete().catchError((_) => tempFile);

      if (!mounted) return;

      if (resultado.motivoRechazo != null) {
        setState(() {
          _procesando = false;
          _estadoTexto = null;
          _mensajeError = _mensajeMotivo(resultado.motivoRechazo!);
          _foto = null;
        });
        widget.onCambio(null);
        return;
      }

      final recorte = _recortarAlCuerpo(bytes, resultado.resultado);
      final capturada = FotoCapturada(
        bytes: recorte.bytes,
        anchoPx: recorte.anchoPx,
        altoPx: recorte.altoPx,
        analisis: recorte.analisis,
      );
      setState(() {
        _procesando = false;
        _estadoTexto = null;
        _foto = capturada;
        _mensajeError = null;
      });
      widget.onCambio(capturada);
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _procesando = false;
        _estadoTexto = null;
        _mensajeError = 'No se pudo procesar la fotografía: $e';
      });
      widget.onCambio(null);
    }
  }

  /// Decodifica la foto y aplica la rotación EXIF a los píxeles reales
  /// (`bakeOrientation`), guardándola en un archivo temporal ya derecho y
  /// sin bandera de rotación. A partir de aquí toda lectura posterior
  /// (compresión, análisis de pose) ve la imagen con la orientación
  /// correcta, en vez de depender de que cada librería/dispositivo
  /// interprete la bandera EXIF de la misma forma.
  Future<String> _hornearOrientacion(String rutaOriginal) async {
    final bytesOriginales = await File(rutaOriginal).readAsBytes();
    final decodificada = img.decodeImage(bytesOriginales);
    if (decodificada == null) return rutaOriginal;

    final orientada = img.bakeOrientation(decodificada);
    final archivoOrientado = await File(
      '${Directory.systemTemp.path}/seguimiento_orientada_${widget.tipo}_${DateTime.now().millisecondsSinceEpoch}.jpg',
    ).create();
    await archivoOrientado.writeAsBytes(img.encodeJpg(orientada, quality: 95));
    return archivoOrientado.path;
  }

  /// Recorta la foto a la zona del cuerpo detectado (con margen), usando el
  /// cuadro delimitador de los landmarks que ya calculó
  /// [PoseAnalysisService.analizarFoto]. Esto quita fondo variable entre
  /// evaluaciones (fotos más consistentes para comparar) y reduce lo que se
  /// sube. Los landmarks se re-normalizan a las nuevas dimensiones para que
  /// sigan siendo coherentes con la imagen que realmente se guarda -- las
  /// métricas de [PoseAnalysisService.calcularMetricas] son proporciones
  /// (distancia / "altura" calculada de los mismos landmarks), así que un
  /// recorte uniforme (misma relación de aspecto que el original) no las
  /// altera.
  ({Uint8List bytes, int anchoPx, int altoPx, ResultadoAnalisisFoto analisis}) _recortarAlCuerpo(
    Uint8List bytesOriginales,
    ResultadoAnalisisFoto analisisOriginal,
  ) {
    final anchoPx = analisisOriginal.anchoPx;
    final altoPx = analisisOriginal.altoPx;
    final sinCambios = (
      bytes: bytesOriginales,
      anchoPx: anchoPx,
      altoPx: altoPx,
      analisis: analisisOriginal,
    );

    final visibles = analisisOriginal.landmarks.where((l) => l.visibility >= 0.3).toList();
    if (visibles.isEmpty || anchoPx <= 0 || altoPx <= 0) return sinCambios;

    final decodificada = img.decodeImage(bytesOriginales);
    if (decodificada == null) return sinCambios;

    double xMin = visibles.map((l) => l.x).reduce(math.min) * anchoPx;
    double xMax = visibles.map((l) => l.x).reduce(math.max) * anchoPx;
    double yMin = visibles.map((l) => l.y).reduce(math.min) * altoPx;
    double yMax = visibles.map((l) => l.y).reduce(math.max) * altoPx;

    // Margen del 15% del tamaño del cuerpo detectado, para no cortar manos,
    // pies o la parte superior de la cabeza.
    final margenX = (xMax - xMin) * 0.15;
    final margenY = (yMax - yMin) * 0.15;
    xMin -= margenX;
    xMax += margenX;
    yMin -= margenY;
    yMax += margenY;

    // Mantener la misma relación de aspecto que la imagen original, para
    // que el recorte sea un escalado+traslado uniforme (no distorsiona las
    // proporciones que usan las métricas).
    final aspectOriginal = anchoPx / altoPx;
    var cropW = xMax - xMin;
    var cropH = yMax - yMin;
    final aspectActual = cropW / cropH;
    if (aspectActual < aspectOriginal) {
      final nuevoAncho = cropH * aspectOriginal;
      final extra = (nuevoAncho - cropW) / 2;
      xMin -= extra;
      xMax += extra;
      cropW = nuevoAncho;
    } else if (aspectActual > aspectOriginal) {
      final nuevoAlto = cropW / aspectOriginal;
      final extra = (nuevoAlto - cropH) / 2;
      yMin -= extra;
      yMax += extra;
      cropH = nuevoAlto;
    }

    xMin = xMin.clamp(0, anchoPx.toDouble());
    xMax = xMax.clamp(0, anchoPx.toDouble());
    yMin = yMin.clamp(0, altoPx.toDouble());
    yMax = yMax.clamp(0, altoPx.toDouble());
    cropW = xMax - xMin;
    cropH = yMax - yMin;
    if (cropW < 10 || cropH < 10) return sinCambios;

    final recortada = img.copyCrop(
      decodificada,
      x: xMin.round(),
      y: yMin.round(),
      width: cropW.round(),
      height: cropH.round(),
    );
    final bytesRecortados = Uint8List.fromList(img.encodeJpg(recortada, quality: 90));
    final nuevoAnchoPx = recortada.width;
    final nuevoAltoPx = recortada.height;

    final landmarksRemapeados = analisisOriginal.landmarks.map((l) {
      final xPx = l.x * anchoPx;
      final yPx = l.y * altoPx;
      return LandmarkCrudo(
        index: l.index,
        x: ((xPx - xMin) / cropW).clamp(0.0, 1.0),
        y: ((yPx - yMin) / cropH).clamp(0.0, 1.0),
        z: l.z,
        visibility: l.visibility,
      );
    }).toList();

    final nuevoAnalisis = ResultadoAnalisisFoto(
      landmarks: landmarksRemapeados,
      calidad: analisisOriginal.calidad,
      confianzaMedia: analisisOriginal.confianzaMedia,
      landmarksValidos: analisisOriginal.landmarksValidos,
      porcentajeCuerpoDetectado: analisisOriginal.porcentajeCuerpoDetectado,
      anchoPx: nuevoAnchoPx,
      altoPx: nuevoAltoPx,
      encuadre: analisisOriginal.encuadre,
    );

    return (bytes: bytesRecortados, anchoPx: nuevoAnchoPx, altoPx: nuevoAltoPx, analisis: nuevoAnalisis);
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: _foto != null ? AppColors.success : AppColors.border),
      ),
      padding: const EdgeInsets.all(14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(
                _foto != null ? Icons.check_circle : Icons.camera_alt_outlined,
                color: _foto != null ? AppColors.success : AppColors.accent,
                size: 20,
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  widget.opcional ? '${widget.titulo} (opcional)' : widget.titulo,
                  style: TextStyle(fontWeight: FontWeight.w700, color: AppColors.textPrimary),
                ),
              ),
              if (_foto != null) _BadgeCalidad(resultado: _foto!.analisis),
            ],
          ),
          const SizedBox(height: 6),
          Text(widget.guia, style: TextStyle(color: AppColors.textSecondary, fontSize: 12)),
          const SizedBox(height: 10),
          if (_foto == null)
            _GuiaSiluetaEncuadre()
          else
            ClipRRect(
              borderRadius: BorderRadius.circular(10),
              child: Image.memory(_foto!.bytes, height: 160, fit: BoxFit.cover, width: double.infinity),
            ),
          if (_foto != null && _foto!.analisis.encuadre == TipoEncuadre.medioCuerpo) ...[
            const SizedBox(height: 8),
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(Icons.info_outline, size: 14, color: AppColors.textSecondary),
                const SizedBox(width: 6),
                Expanded(
                  child: Text(
                    'Captura de medio cuerpo: las medidas de piernas no estarán disponibles en esta evaluación.',
                    style: TextStyle(color: AppColors.textSecondary, fontSize: 11, fontStyle: FontStyle.italic),
                  ),
                ),
              ],
            ),
          ],
          if (_procesando) ...[
            const SizedBox(height: 10),
            Row(
              children: [
                const SizedBox(
                  width: 16, height: 16,
                  child: CircularProgressIndicator(strokeWidth: 2),
                ),
                const SizedBox(width: 10),
                Text(_estadoTexto ?? 'Procesando...', style: TextStyle(color: AppColors.textSecondary, fontSize: 12)),
              ],
            ),
          ],
          if (_mensajeError != null) ...[
            const SizedBox(height: 10),
            Text(_mensajeError!, style: TextStyle(color: AppColors.danger, fontSize: 12)),
          ],
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: _procesando ? null : () => _capturar(ImageSource.camera),
                  icon: const Icon(Icons.camera_alt_outlined, size: 18),
                  label: Text(_foto != null ? 'Repetir foto' : 'Tomar foto'),
                ),
              ),
              const SizedBox(width: 8),
              IconButton(
                tooltip: 'Elegir de la galería',
                onPressed: _procesando ? null : () => _capturar(ImageSource.gallery),
                icon: Icon(Icons.photo_library_outlined, color: AppColors.textSecondary),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

/// Chip "Buena · 82/100" con el resultado del control de calidad de la
/// foto ya aceptada (sección 9: diferenciar Excelente/Buena/Aceptable/
/// Insuficiente en vez de solo aceptar/rechazar).
class _BadgeCalidad extends StatelessWidget {
  final ResultadoAnalisisFoto resultado;
  const _BadgeCalidad({required this.resultado});

  Color _color() {
    switch (resultado.calidadCaptura) {
      case CalidadCaptura.excelente:
        return AppColors.success;
      case CalidadCaptura.buena:
        return AppColors.accent;
      case CalidadCaptura.aceptable:
        return AppColors.textSecondary;
      case CalidadCaptura.insuficiente:
        return AppColors.danger;
    }
  }

  @override
  Widget build(BuildContext context) {
    final color = _color();
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(color: color.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(8)),
      child: Text(
        '${calidadCapturaLabel(resultado.calidadCaptura)} · ${resultado.qualityScore}/100',
        style: TextStyle(color: color, fontWeight: FontWeight.w700, fontSize: 10),
      ),
    );
  }
}

/// Silueta de referencia mostrada ANTES de tomar la foto, para que el
/// usuario entienda de un vistazo cómo encuadrarse (cuerpo completo,
/// centrado, cámara a la altura) sin tener que leer el texto de guía. Es
/// estática -- la app abre la cámara nativa del teléfono (`image_picker`),
/// que no permite dibujar una guía en vivo sobre la vista de la cámara; eso
/// requeriría un flujo de cámara propio (paquete `camera`).
class _GuiaSiluetaEncuadre extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Container(
      height: 160,
      width: double.infinity,
      decoration: BoxDecoration(
        color: AppColors.background,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: AppColors.border, width: 1),
      ),
      child: CustomPaint(
        painter: _SiluetaPainter(color: AppColors.textSecondary.withValues(alpha: 0.5)),
      ),
    );
  }
}

class _SiluetaPainter extends CustomPainter {
  final Color color;
  _SiluetaPainter({required this.color});

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2
      ..strokeCap = StrokeCap.round;

    // Marco punteado indicando el área de encuadre.
    _dibujarMarcoPunteado(canvas, size, paint);

    // Figura de palo centrada: cabeza, hombros/brazos, torso y piernas.
    final centroX = size.width / 2;
    final altoFigura = size.height * 0.82;
    final topeY = size.height * 0.09;
    final radioCabeza = altoFigura * 0.11;
    final cabezaCentroY = topeY + radioCabeza;
    final hombrosY = cabezaCentroY + radioCabeza + altoFigura * 0.03;
    final caderaY = topeY + altoFigura * 0.52;
    final piesY = topeY + altoFigura;
    final medioAnchoHombros = size.width * 0.16;
    final medioAnchoCadera = size.width * 0.10;
    final medioAnchoPies = size.width * 0.12;

    canvas.drawCircle(Offset(centroX, cabezaCentroY), radioCabeza, paint);

    // Hombros + brazos ligeramente separados del cuerpo.
    canvas.drawLine(Offset(centroX - medioAnchoHombros, hombrosY), Offset(centroX + medioAnchoHombros, hombrosY), paint);
    canvas.drawLine(Offset(centroX - medioAnchoHombros, hombrosY), Offset(centroX - medioAnchoHombros * 1.15, caderaY), paint);
    canvas.drawLine(Offset(centroX + medioAnchoHombros, hombrosY), Offset(centroX + medioAnchoHombros * 1.15, caderaY), paint);

    // Torso.
    canvas.drawLine(Offset(centroX - medioAnchoHombros, hombrosY), Offset(centroX - medioAnchoCadera, caderaY), paint);
    canvas.drawLine(Offset(centroX + medioAnchoHombros, hombrosY), Offset(centroX + medioAnchoCadera, caderaY), paint);
    canvas.drawLine(Offset(centroX - medioAnchoCadera, caderaY), Offset(centroX + medioAnchoCadera, caderaY), paint);

    // Piernas.
    canvas.drawLine(Offset(centroX - medioAnchoCadera, caderaY), Offset(centroX - medioAnchoPies, piesY), paint);
    canvas.drawLine(Offset(centroX + medioAnchoCadera, caderaY), Offset(centroX + medioAnchoPies, piesY), paint);
  }

  void _dibujarMarcoPunteado(Canvas canvas, Size size, Paint basePaint) {
    final marco = Paint()
      ..color = basePaint.color.withValues(alpha: basePaint.color.a * 0.6)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.5;
    const margen = 10.0;
    const guionLargo = 6.0;
    const hueco = 4.0;
    final rect = Rect.fromLTWH(margen, margen, size.width - margen * 2, size.height - margen * 2);

    void lineaPunteada(Offset inicio, Offset fin) {
      final distancia = (fin - inicio).distance;
      final direccion = (fin - inicio) / distancia;
      var recorrido = 0.0;
      while (recorrido < distancia) {
        final desde = inicio + direccion * recorrido;
        final hasta = inicio + direccion * math.min(recorrido + guionLargo, distancia);
        canvas.drawLine(desde, hasta, marco);
        recorrido += guionLargo + hueco;
      }
    }

    lineaPunteada(rect.topLeft, rect.topRight);
    lineaPunteada(rect.topRight, rect.bottomRight);
    lineaPunteada(rect.bottomRight, rect.bottomLeft);
    lineaPunteada(rect.bottomLeft, rect.topLeft);
  }

  @override
  bool shouldRepaint(covariant _SiluetaPainter oldDelegate) => oldDelegate.color != color;
}
