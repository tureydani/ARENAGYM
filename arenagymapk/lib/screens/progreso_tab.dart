import 'package:flutter/material.dart';

import '../models/meta.dart';
import '../models/progreso.dart';
import '../services/api_exception.dart';
import '../services/api_service.dart';
import '../theme/app_theme.dart';
import '../widgets/app_card.dart';
import 'asistencias_calendario_tab.dart';

/// Pestaña "Progreso": combina Metas, Mediciones y Asistencias en tres
/// sub-tabs dentro de una misma pestaña, para que el cliente vea su espacio
/// personal de evolución sin salir de la sección.
class ProgresoTab extends StatefulWidget {
  const ProgresoTab({super.key});

  @override
  State<ProgresoTab> createState() => _ProgresoTabState();
}

class _ProgresoTabState extends State<ProgresoTab> with SingleTickerProviderStateMixin {
  late final TabController _tabController;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
          child: Align(
            alignment: Alignment.centerLeft,
            child: Text(
              'Progreso',
              style: Theme.of(context).appBarTheme.titleTextStyle,
            ),
          ),
        ),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: Container(
            decoration: BoxDecoration(
              color: AppColors.card,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: AppColors.border),
            ),
            child: TabBar(
              controller: _tabController,
              indicator: BoxDecoration(
                color: AppColors.accent,
                borderRadius: BorderRadius.circular(12),
              ),
              indicatorSize: TabBarIndicatorSize.tab,
              dividerColor: Colors.transparent,
              labelColor: Colors.white,
              unselectedLabelColor: AppColors.textSecondary,
              labelStyle: const TextStyle(fontWeight: FontWeight.w700),
              tabs: const [
                Tab(text: 'Metas'),
                Tab(text: 'Mediciones'),
                Tab(text: 'Asistencias'),
              ],
            ),
          ),
        ),
        Expanded(
          child: TabBarView(
            controller: _tabController,
            children: const [
              _MetasSection(),
              _ProgresosSection(),
              AsistenciasCalendarioTab(),
            ],
          ),
        ),
      ],
    );
  }
}

// ---------------------------------------------------------------------------
// Metas
// ---------------------------------------------------------------------------

class _MetasSection extends StatefulWidget {
  const _MetasSection();

  @override
  State<_MetasSection> createState() => _MetasSectionState();
}

class _MetasSectionState extends State<_MetasSection> {
  bool _loading = true;
  String? _errorMessage;
  List<Meta> _metas = [];

  @override
  void initState() {
    super.initState();
    _cargarDatos();
  }

  Future<void> _cargarDatos() async {
    setState(() {
      _loading = true;
      _errorMessage = null;
    });
    try {
      final metas = await ApiService.instance.getMetas();
      if (!mounted) return;
      setState(() {
        _metas = metas;
        _loading = false;
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _errorMessage = e.message;
        _loading = false;
      });
    }
  }

  Color _colorEstado(String estado) {
    switch (estado) {
      case 'cumplida':
        return AppColors.success;
      case 'cancelada':
        return AppColors.danger;
      default:
        return AppColors.accent;
    }
  }

  String _labelEstado(String estado) {
    switch (estado) {
      case 'cumplida':
        return 'Cumplida';
      case 'cancelada':
        return 'Cancelada';
      default:
        return 'Activa';
    }
  }

  Future<void> _abrirFormularioNuevaMeta() async {
    final creada = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => const _NuevaMetaSheet(),
    );
    if (creada == true) _cargarDatos();
  }

  Future<void> _actualizarValorActual(Meta meta) async {
    final controller = TextEditingController(
      text: meta.valorActual?.toString() ?? '',
    );
    final nuevoValor = await showDialog<double>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text('Actualizar "${meta.tipoMeta}"'),
        content: TextField(
          controller: controller,
          keyboardType: const TextInputType.numberWithOptions(decimal: true),
          autofocus: true,
          decoration: const InputDecoration(labelText: 'Valor actual'),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('Cancelar'),
          ),
          ElevatedButton(
            onPressed: () {
              final valor = double.tryParse(controller.text.trim());
              Navigator.of(context).pop(valor);
            },
            child: const Text('Guardar'),
          ),
        ],
      ),
    );

    if (nuevoValor == null) return;

    try {
      final actualizada = await ApiService.instance.actualizarMeta(
        meta.idMeta,
        valorActual: nuevoValor,
      );
      if (!mounted) return;
      setState(() {
        final index = _metas.indexWhere((m) => m.idMeta == meta.idMeta);
        if (index != -1) _metas[index] = actualizada;
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.transparent,
      floatingActionButton: FloatingActionButton(
        onPressed: _abrirFormularioNuevaMeta,
        backgroundColor: AppColors.accent,
        child: const Icon(Icons.add, color: Colors.white),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _errorMessage != null
              ? _buildError()
              : RefreshIndicator(
                  onRefresh: _cargarDatos,
                  child: _metas.isEmpty
                      ? ListView(
                          padding: const EdgeInsets.all(16),
                          children: const [
                            AppCard(
                              child: Text(
                                'Aún no tienes metas registradas. Toca el botón "+" '
                                'para crear la primera.',
                                style: TextStyle(color: AppColors.textSecondary),
                              ),
                            ),
                          ],
                        )
                      : ListView.separated(
                          padding: const EdgeInsets.fromLTRB(16, 0, 16, 96),
                          itemCount: _metas.length,
                          separatorBuilder: (_, _) => const SizedBox(height: 10),
                          itemBuilder: (context, index) => _buildMetaCard(_metas[index]),
                        ),
                ),
    );
  }

  Widget _buildError() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.wifi_off, size: 48, color: AppColors.textSecondary),
            const SizedBox(height: 16),
            Text(
              _errorMessage!,
              textAlign: TextAlign.center,
              style: const TextStyle(color: AppColors.textSecondary),
            ),
            const SizedBox(height: 16),
            ElevatedButton(onPressed: _cargarDatos, child: const Text('Reintentar')),
          ],
        ),
      ),
    );
  }

  Widget _buildMetaCard(Meta meta) {
    final progreso = meta.progreso;
    final color = _colorEstado(meta.estado);
    final esActiva = meta.estado == 'activa';

    return InkWell(
      borderRadius: BorderRadius.circular(16),
      onTap: esActiva ? () => _actualizarValorActual(meta) : null,
      child: AppCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    meta.tipoMeta,
                    style: const TextStyle(
                      fontWeight: FontWeight.w700,
                      fontSize: 16,
                      color: AppColors.textPrimary,
                    ),
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: color.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Text(
                    _labelEstado(meta.estado),
                    style: TextStyle(color: color, fontWeight: FontWeight.w700, fontSize: 12),
                  ),
                ),
              ],
            ),
            if (meta.descripcion != null && meta.descripcion!.isNotEmpty) ...[
              const SizedBox(height: 6),
              Text(
                meta.descripcion!,
                style: const TextStyle(color: AppColors.textSecondary, fontSize: 13),
              ),
            ],
            const SizedBox(height: 12),
            if (progreso != null) ...[
              ClipRRect(
                borderRadius: BorderRadius.circular(8),
                child: LinearProgressIndicator(
                  value: progreso,
                  minHeight: 10,
                  backgroundColor: AppColors.background,
                  valueColor: AlwaysStoppedAnimation(color),
                ),
              ),
              const SizedBox(height: 8),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    'Inicial: ${meta.valorInicial}',
                    style: const TextStyle(color: AppColors.textSecondary, fontSize: 12),
                  ),
                  Text(
                    'Actual: ${meta.valorActual}',
                    style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 12),
                  ),
                  Text(
                    'Meta: ${meta.valorObjetivo}',
                    style: const TextStyle(color: AppColors.textSecondary, fontSize: 12),
                  ),
                ],
              ),
              const SizedBox(height: 8),
            ],
            if (meta.fechaObjetivo != null)
              Row(
                children: [
                  const Icon(Icons.event_outlined, size: 16, color: AppColors.textSecondary),
                  const SizedBox(width: 6),
                  Text(
                    'Objetivo: ${meta.fechaObjetivo}',
                    style: const TextStyle(color: AppColors.textSecondary, fontSize: 12),
                  ),
                ],
              ),
            if (esActiva) ...[
              const SizedBox(height: 4),
              const Text(
                'Toca para actualizar tu avance',
                style: TextStyle(color: AppColors.accent, fontSize: 11, fontStyle: FontStyle.italic),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _NuevaMetaSheet extends StatefulWidget {
  const _NuevaMetaSheet();

  @override
  State<_NuevaMetaSheet> createState() => _NuevaMetaSheetState();
}

class _NuevaMetaSheetState extends State<_NuevaMetaSheet> {
  final _formKey = GlobalKey<FormState>();
  final _tipoController = TextEditingController();
  final _valorInicialController = TextEditingController();
  final _valorObjetivoController = TextEditingController();
  final _valorActualController = TextEditingController();
  final _descripcionController = TextEditingController();
  DateTime? _fechaObjetivo;
  bool _guardando = false;
  String? _errorMessage;

  @override
  void dispose() {
    _tipoController.dispose();
    _valorInicialController.dispose();
    _valorObjetivoController.dispose();
    _valorActualController.dispose();
    _descripcionController.dispose();
    super.dispose();
  }

  Future<void> _elegirFecha() async {
    final fecha = await showDatePicker(
      context: context,
      initialDate: DateTime.now(),
      firstDate: DateTime.now(),
      lastDate: DateTime.now().add(const Duration(days: 365 * 3)),
    );
    if (fecha != null) setState(() => _fechaObjetivo = fecha);
  }

  Future<void> _guardar() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() {
      _guardando = true;
      _errorMessage = null;
    });

    try {
      await ApiService.instance.crearMeta(
        tipoMeta: _tipoController.text.trim(),
        valorInicial: double.tryParse(_valorInicialController.text.trim()),
        valorObjetivo: double.tryParse(_valorObjetivoController.text.trim()),
        valorActual: double.tryParse(_valorActualController.text.trim()),
        fechaObjetivo: _fechaObjetivo == null
            ? null
            : '${_fechaObjetivo!.year.toString().padLeft(4, '0')}-'
                '${_fechaObjetivo!.month.toString().padLeft(2, '0')}-'
                '${_fechaObjetivo!.day.toString().padLeft(2, '0')}',
        descripcion: _descripcionController.text.trim().isEmpty
            ? null
            : _descripcionController.text.trim(),
      );
      if (!mounted) return;
      Navigator.of(context).pop(true);
    } on ApiException catch (e) {
      setState(() {
        _errorMessage = e.message;
        _guardando = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
      child: Container(
        decoration: const BoxDecoration(
          color: AppColors.card,
          borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
        ),
        padding: const EdgeInsets.fromLTRB(20, 16, 20, 24),
        child: SingleChildScrollView(
          child: Form(
            key: _formKey,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Center(
                  child: Container(
                    width: 40,
                    height: 4,
                    margin: const EdgeInsets.only(bottom: 16),
                    decoration: BoxDecoration(
                      color: AppColors.border,
                      borderRadius: BorderRadius.circular(4),
                    ),
                  ),
                ),
                const Text(
                  'Nueva meta',
                  style: TextStyle(fontWeight: FontWeight.w800, fontSize: 18),
                ),
                const SizedBox(height: 16),
                if (_errorMessage != null) ...[
                  Text(_errorMessage!, style: const TextStyle(color: AppColors.danger)),
                  const SizedBox(height: 12),
                ],
                TextFormField(
                  controller: _tipoController,
                  decoration: const InputDecoration(labelText: 'Tipo de meta (ej. Bajar de peso)'),
                  validator: (v) => (v == null || v.trim().isEmpty) ? 'Requerido' : null,
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(
                      child: TextFormField(
                        controller: _valorInicialController,
                        keyboardType: const TextInputType.numberWithOptions(decimal: true),
                        decoration: const InputDecoration(labelText: 'Valor inicial'),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: TextFormField(
                        controller: _valorActualController,
                        keyboardType: const TextInputType.numberWithOptions(decimal: true),
                        decoration: const InputDecoration(labelText: 'Valor actual'),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: _valorObjetivoController,
                  keyboardType: const TextInputType.numberWithOptions(decimal: true),
                  decoration: const InputDecoration(labelText: 'Valor objetivo'),
                ),
                const SizedBox(height: 12),
                InkWell(
                  onTap: _elegirFecha,
                  child: InputDecorator(
                    decoration: const InputDecoration(labelText: 'Fecha objetivo'),
                    child: Text(
                      _fechaObjetivo == null
                          ? 'Sin definir'
                          : '${_fechaObjetivo!.day}/${_fechaObjetivo!.month}/${_fechaObjetivo!.year}',
                    ),
                  ),
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: _descripcionController,
                  decoration: const InputDecoration(labelText: 'Descripción (opcional)'),
                  maxLines: 2,
                ),
                const SizedBox(height: 20),
                ElevatedButton(
                  onPressed: _guardando ? null : _guardar,
                  child: _guardando
                      ? const SizedBox(
                          width: 22,
                          height: 22,
                          child: CircularProgressIndicator(strokeWidth: 2.5, color: Colors.white),
                        )
                      : const Text('Crear meta'),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Progresos (mediciones físicas)
// ---------------------------------------------------------------------------

class _ProgresosSection extends StatefulWidget {
  const _ProgresosSection();

  @override
  State<_ProgresosSection> createState() => _ProgresosSectionState();
}

class _ProgresosSectionState extends State<_ProgresosSection> {
  bool _loading = true;
  String? _errorMessage;
  List<Progreso> _progresos = [];

  @override
  void initState() {
    super.initState();
    _cargarDatos();
  }

  Future<void> _cargarDatos() async {
    setState(() {
      _loading = true;
      _errorMessage = null;
    });
    try {
      final progresos = await ApiService.instance.getProgresos();
      progresos.sort((a, b) => b.fecha.compareTo(a.fecha));
      if (!mounted) return;
      setState(() {
        _progresos = progresos;
        _loading = false;
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _errorMessage = e.message;
        _loading = false;
      });
    }
  }

  Future<void> _abrirFormularioNuevoProgreso() async {
    final creado = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => const _NuevoProgresoSheet(),
    );
    if (creado == true) _cargarDatos();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.transparent,
      floatingActionButton: FloatingActionButton(
        onPressed: _abrirFormularioNuevoProgreso,
        backgroundColor: AppColors.accent,
        child: const Icon(Icons.add, color: Colors.white),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _errorMessage != null
              ? _buildError()
              : RefreshIndicator(
                  onRefresh: _cargarDatos,
                  child: _progresos.isEmpty
                      ? ListView(
                          padding: const EdgeInsets.all(16),
                          children: const [
                            AppCard(
                              child: Text(
                                'Aún no tienes mediciones registradas. Toca el botón "+" '
                                'para agregar la primera.',
                                style: TextStyle(color: AppColors.textSecondary),
                              ),
                            ),
                          ],
                        )
                      : ListView.separated(
                          padding: const EdgeInsets.fromLTRB(16, 0, 16, 96),
                          itemCount: _progresos.length,
                          separatorBuilder: (_, _) => const SizedBox(height: 10),
                          itemBuilder: (context, index) => _buildProgresoCard(_progresos[index]),
                        ),
                ),
    );
  }

  Widget _buildError() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.wifi_off, size: 48, color: AppColors.textSecondary),
            const SizedBox(height: 16),
            Text(
              _errorMessage!,
              textAlign: TextAlign.center,
              style: const TextStyle(color: AppColors.textSecondary),
            ),
            const SizedBox(height: 16),
            ElevatedButton(onPressed: _cargarDatos, child: const Text('Reintentar')),
          ],
        ),
      ),
    );
  }

  Widget _buildProgresoCard(Progreso progreso) {
    final medidas = <String, double?>{
      'Peso (kg)': progreso.peso,
      '% Grasa': progreso.porcentajeGrasa,
      'Pecho (cm)': progreso.pecho,
      'Cintura (cm)': progreso.cintura,
      'Brazo (cm)': progreso.brazo,
      'Pierna (cm)': progreso.pierna,
      'Cadera (cm)': progreso.cadera,
    }..removeWhere((key, value) => value == null);

    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.monitor_weight_outlined, size: 18, color: AppColors.accent),
              const SizedBox(width: 8),
              Text(
                progreso.fecha,
                style: const TextStyle(fontWeight: FontWeight.w700, color: AppColors.textPrimary),
              ),
            ],
          ),
          if (medidas.isNotEmpty) ...[
            const SizedBox(height: 12),
            Wrap(
              spacing: 16,
              runSpacing: 8,
              children: [
                for (final entry in medidas.entries)
                  SizedBox(
                    width: 100,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          entry.key,
                          style: const TextStyle(color: AppColors.textSecondary, fontSize: 11),
                        ),
                        Text(
                          entry.value!.toStringAsFixed(1),
                          style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14),
                        ),
                      ],
                    ),
                  ),
              ],
            ),
          ],
          if (progreso.observaciones != null && progreso.observaciones!.isNotEmpty) ...[
            const SizedBox(height: 12),
            const Divider(height: 1),
            const SizedBox(height: 8),
            Text(
              progreso.observaciones!,
              style: const TextStyle(color: AppColors.textSecondary, fontSize: 13),
            ),
          ],
        ],
      ),
    );
  }
}

class _NuevoProgresoSheet extends StatefulWidget {
  const _NuevoProgresoSheet();

  @override
  State<_NuevoProgresoSheet> createState() => _NuevoProgresoSheetState();
}

class _NuevoProgresoSheetState extends State<_NuevoProgresoSheet> {
  final _formKey = GlobalKey<FormState>();
  final _pesoController = TextEditingController();
  final _grasaController = TextEditingController();
  final _pechoController = TextEditingController();
  final _cinturaController = TextEditingController();
  final _brazoController = TextEditingController();
  final _piernaController = TextEditingController();
  final _caderaController = TextEditingController();
  final _observacionesController = TextEditingController();
  bool _guardando = false;
  String? _errorMessage;

  @override
  void dispose() {
    _pesoController.dispose();
    _grasaController.dispose();
    _pechoController.dispose();
    _cinturaController.dispose();
    _brazoController.dispose();
    _piernaController.dispose();
    _caderaController.dispose();
    _observacionesController.dispose();
    super.dispose();
  }

  bool get _tieneAlMenosUnCampo {
    return [
      _pesoController.text,
      _grasaController.text,
      _pechoController.text,
      _cinturaController.text,
      _brazoController.text,
      _piernaController.text,
      _caderaController.text,
    ].any((v) => v.trim().isNotEmpty);
  }

  Future<void> _guardar() async {
    if (!_formKey.currentState!.validate()) return;

    if (!_tieneAlMenosUnCampo) {
      setState(() => _errorMessage = 'Ingresa al menos una medición.');
      return;
    }

    setState(() {
      _guardando = true;
      _errorMessage = null;
    });

    try {
      await ApiService.instance.crearProgreso(
        peso: double.tryParse(_pesoController.text.trim()),
        porcentajeGrasa: double.tryParse(_grasaController.text.trim()),
        pecho: double.tryParse(_pechoController.text.trim()),
        cintura: double.tryParse(_cinturaController.text.trim()),
        brazo: double.tryParse(_brazoController.text.trim()),
        pierna: double.tryParse(_piernaController.text.trim()),
        cadera: double.tryParse(_caderaController.text.trim()),
        observaciones: _observacionesController.text.trim().isEmpty
            ? null
            : _observacionesController.text.trim(),
      );
      if (!mounted) return;
      Navigator.of(context).pop(true);
    } on ApiException catch (e) {
      setState(() {
        _errorMessage = e.message;
        _guardando = false;
      });
    }
  }

  Widget _campoNumerico(String label, TextEditingController controller) {
    return Expanded(
      child: TextFormField(
        controller: controller,
        keyboardType: const TextInputType.numberWithOptions(decimal: true),
        decoration: InputDecoration(labelText: label),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
      child: Container(
        decoration: const BoxDecoration(
          color: AppColors.card,
          borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
        ),
        padding: const EdgeInsets.fromLTRB(20, 16, 20, 24),
        child: SingleChildScrollView(
          child: Form(
            key: _formKey,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Center(
                  child: Container(
                    width: 40,
                    height: 4,
                    margin: const EdgeInsets.only(bottom: 16),
                    decoration: BoxDecoration(
                      color: AppColors.border,
                      borderRadius: BorderRadius.circular(4),
                    ),
                  ),
                ),
                const Text(
                  'Nueva medición',
                  style: TextStyle(fontWeight: FontWeight.w800, fontSize: 18),
                ),
                const SizedBox(height: 4),
                const Text(
                  'Todos los campos son opcionales, pero llena al menos uno.',
                  style: TextStyle(color: AppColors.textSecondary, fontSize: 12),
                ),
                const SizedBox(height: 16),
                if (_errorMessage != null) ...[
                  Text(_errorMessage!, style: const TextStyle(color: AppColors.danger)),
                  const SizedBox(height: 12),
                ],
                Row(
                  children: [
                    _campoNumerico('Peso (kg)', _pesoController),
                    const SizedBox(width: 12),
                    _campoNumerico('% Grasa', _grasaController),
                  ],
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    _campoNumerico('Pecho (cm)', _pechoController),
                    const SizedBox(width: 12),
                    _campoNumerico('Cintura (cm)', _cinturaController),
                  ],
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    _campoNumerico('Brazo (cm)', _brazoController),
                    const SizedBox(width: 12),
                    _campoNumerico('Pierna (cm)', _piernaController),
                  ],
                ),
                const SizedBox(height: 12),
                _campoNumerico('Cadera (cm)', _caderaController),
                const SizedBox(height: 12),
                TextFormField(
                  controller: _observacionesController,
                  decoration: const InputDecoration(labelText: 'Observaciones (opcional)'),
                  maxLines: 2,
                ),
                const SizedBox(height: 20),
                ElevatedButton(
                  onPressed: _guardando ? null : _guardar,
                  child: _guardando
                      ? const SizedBox(
                          width: 22,
                          height: 22,
                          child: CircularProgressIndicator(strokeWidth: 2.5, color: Colors.white),
                        )
                      : const Text('Guardar medición'),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
