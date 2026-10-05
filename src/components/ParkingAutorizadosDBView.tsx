/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  ParkingAutorizadoItem,
  DEFAULT_PARKING_AUTORIZADOS,
  getStoredParkingAutorizados,
  saveStoredParkingAutorizados,
  CLIENTES_AUTORIZADOS_PARKING
} from '../utils/parkingAuth';
import { db } from '../lib/firebase';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import {
  ShieldCheck,
  UserCheck,
  Building2,
  User,
  Plus,
  Trash2,
  Edit2,
  Check,
  X,
  Search,
  RotateCcw,
  Sparkles,
  Info,
  Clock,
  Mail,
  ToggleLeft,
  ToggleRight,
  ShieldAlert,
  Save
} from 'lucide-react';

interface ParkingAutorizadosDBViewProps {
  showNotification?: (msg: string) => void;
}

export const ParkingAutorizadosDBView: React.FC<ParkingAutorizadosDBViewProps> = ({
  showNotification
}) => {
  const [autorizados, setAutorizados] = useState<ParkingAutorizadoItem[]>(() => {
    return getStoredParkingAutorizados();
  });

  const [searchTerm, setSearchTerm] = useState('');
  const [filterTipo, setFilterTipo] = useState<'TODOS' | 'CLIENTE' | 'DESPACHANTE' | 'ADMIN'>('TODOS');
  const [filterEstado, setFilterEstado] = useState<'TODOS' | 'HABILITADO' | 'DESHABILITADO'>('TODOS');

  // Modal / Formulario de Alta y Edición
  const [modalItem, setModalItem] = useState<Partial<ParkingAutorizadoItem> | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [formError, setFormError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Sincronización en tiempo real con Firestore
  useEffect(() => {
    try {
      const docRef = doc(db, 'config', 'parking_autorizados');
      const unsub = onSnapshot(docRef, (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          if (Array.isArray(data.items) && data.items.length > 0) {
            // Asegurar que Matias Green para Stine esté presente
            const hasMatias = data.items.some((p: ParkingAutorizadoItem) =>
              p.nombre.toLowerCase().includes('green') || p.nombre.toLowerCase().includes('matias')
            );
            let finalItems = [...data.items];
            if (!hasMatias) {
              finalItems.push({
                id: 'desp-matias-green',
                nombre: 'Matias Green',
                tipo: 'DESPACHANTE',
                clienteAsignado: 'Stine',
                habilitado: true,
                email: 'matias.green@stine.com',
                observaciones: 'Despachante autorizado para Stine'
              });
            }
            setAutorizados(finalItems);
            saveStoredParkingAutorizados(finalItems);
            return;
          }
        }
        // Si no existe en Firestore, guardar la configuración inicial
        const initial = getStoredParkingAutorizados();
        setDoc(docRef, { items: initial, updatedAt: new Date().toISOString() }, { merge: true }).catch(console.warn);
      }, (err) => {
        console.warn('Error suscribiendo a parking_autorizados en Firestore, usando almacenamiento local:', err);
      });

      return () => unsub();
    } catch (e) {
      console.warn('Firestore fallback local para autorizados de parking:', e);
    }
  }, []);

  // Guardar lista en Firestore y LocalStorage
  const persistAutorizados = async (newItems: ParkingAutorizadoItem[], msg?: string) => {
    setAutorizados(newItems);
    saveStoredParkingAutorizados(newItems);
    try {
      const docRef = doc(db, 'config', 'parking_autorizados');
      await setDoc(docRef, {
        items: newItems,
        updatedAt: new Date().toISOString()
      }, { merge: true });
      if (msg && showNotification) {
        showNotification(msg);
      }
    } catch (err) {
      console.error('Error al guardar autorizados en Firestore:', err);
      if (msg && showNotification) {
        showNotification(`${msg} (guardado en caché local)`);
      }
    }
  };

  // Filtrado reactivo de ítems
  const itemsFiltrados = useMemo(() => {
    return autorizados.filter((item) => {
      // Filtro Tipo
      if (filterTipo !== 'TODOS' && item.tipo !== filterTipo) return false;

      // Filtro Estado
      if (filterEstado === 'HABILITADO' && !item.habilitado) return false;
      if (filterEstado === 'DESHABILITADO' && item.habilitado) return false;

      // Búsqueda
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase().trim();
        const nom = (item.nombre || '').toLowerCase();
        const cli = (item.clienteAsignado || '').toLowerCase();
        const mail = (item.email || '').toLowerCase();
        const obs = (item.observaciones || '').toLowerCase();
        return nom.includes(term) || cli.includes(term) || mail.includes(term) || obs.includes(term);
      }

      return true;
    });
  }, [autorizados, filterTipo, filterEstado, searchTerm]);

  // Contadores
  const stats = useMemo(() => {
    return {
      total: autorizados.length,
      clientes: autorizados.filter(a => a.tipo === 'CLIENTE' && a.habilitado).length,
      despachantes: autorizados.filter(a => a.tipo === 'DESPACHANTE' && a.habilitado).length,
      admins: autorizados.filter(a => a.tipo === 'ADMIN' && a.habilitado).length,
    };
  }, [autorizados]);

  // Alternar habilitación rápida
  const handleToggleHabilitado = async (item: ParkingAutorizadoItem) => {
    const updated = autorizados.map(a =>
      a.id === item.id ? { ...a, habilitado: !a.habilitado } : a
    );
    await persistAutorizados(
      updated,
      `${item.nombre} ahora está ${!item.habilitado ? 'Habilitado' : 'Deshabilitado'} para ingresar a Parking.`
    );
  };

  // Eliminar ítem
  const handleDeleteItem = async (item: ParkingAutorizadoItem) => {
    if (!window.confirm(`¿Seguro que deseas eliminar a "${item.nombre}" de la base de autorizados de Parking?`)) {
      return;
    }
    const updated = autorizados.filter(a => a.id !== item.id);
    await persistAutorizados(updated, `"${item.nombre}" eliminado de autorizados de Parking.`);
  };

  // Abrir modal de creación
  const handleAbrirCrear = () => {
    setIsEditing(false);
    setFormError('');
    setModalItem({
      id: `usr-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      nombre: '',
      tipo: 'DESPACHANTE',
      clienteAsignado: 'Stine',
      email: '',
      habilitado: true,
      observaciones: ''
    });
  };

  // Abrir modal de edición
  const handleAbrirEditar = (item: ParkingAutorizadoItem) => {
    setIsEditing(true);
    setFormError('');
    setModalItem({ ...item });
  };

  // Guardar formulario de modal
  const handleGuardarModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalItem || !modalItem.nombre?.trim()) {
      setFormError('El nombre completo es obligatorio.');
      return;
    }

    setIsSaving(true);
    try {
      const cleanNombre = modalItem.nombre.trim();
      const cleanItem: ParkingAutorizadoItem = {
        id: modalItem.id || `usr-${Date.now()}`,
        nombre: cleanNombre,
        tipo: modalItem.tipo || 'DESPACHANTE',
        clienteAsignado: modalItem.clienteAsignado?.trim() || (modalItem.tipo === 'CLIENTE' ? cleanNombre : 'Todos'),
        email: modalItem.email?.trim() || undefined,
        habilitado: modalItem.habilitado ?? true,
        observaciones: modalItem.observaciones?.trim() || undefined
      };

      let nextList: ParkingAutorizadoItem[];
      if (isEditing) {
        nextList = autorizados.map(a => a.id === cleanItem.id ? cleanItem : a);
      } else {
        nextList = [cleanItem, ...autorizados];
      }

      await persistAutorizados(
        nextList,
        isEditing
          ? `Registro de "${cleanItem.nombre}" actualizado con éxito.`
          : `Nuevo autorizado "${cleanItem.nombre}" (${cleanItem.tipo}) dado de alta para Parking.`
      );

      setModalItem(null);
    } finally {
      setIsSaving(false);
    }
  };

  // Restablecer valores oficiales
  const handleRestablecerOficiales = async () => {
    if (!window.confirm('¿Restablecer la base de autorizados de Parking a los valores oficiales del sistema? Esto incluirá a Matías Green para Stine y los 4 clientes habilitados.')) {
      return;
    }
    await persistAutorizados([...DEFAULT_PARKING_AUTORIZADOS], 'Base de datos de Parking restablecida a los valores oficiales.');
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* CABECERA DE LA BASE DE DATOS DE PARKING */}
      <div className="bg-gradient-to-r from-emerald-950 via-[#00603C] to-[#1c3a26] text-white p-6 sm:p-7 rounded-3xl shadow-xl border border-emerald-800/40 relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div className="flex items-start gap-3.5">
            <div className="p-3 bg-white/10 rounded-2xl border border-white/20 shadow-inner">
              <Clock className="w-7 h-7 text-amber-300" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-mono font-bold tracking-widest text-amber-300 uppercase bg-amber-400/20 px-2.5 py-0.5 rounded-md border border-amber-300/30">
                  BASE DE DATOS PERSISTENTE · PARKING
                </span>
                <span className="text-xs text-emerald-200 font-mono font-bold">
                  Firestore / Sincronizado
                </span>
              </div>
              <h2 className="font-serif text-2xl sm:text-3xl font-black mt-1 text-white tracking-tight">
                Clientes y Despachantes Autorizados
              </h2>
              <p className="text-xs sm:text-sm text-emerald-100/90 max-w-2xl mt-0.5 leading-relaxed">
                Control de acceso, vinculación de despachantes por cliente comitente (incluido <strong className="text-amber-300">Matías Green para Stine</strong>) y asignación de correos para notificaciones de precarga y cancelación.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap shrink-0">
            <button
              type="button"
              onClick={handleRestablecerOficiales}
              className="px-3.5 py-2.5 bg-white/10 hover:bg-white/20 text-emerald-100 hover:text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer border border-white/15 shadow-2xs"
              title="Restablecer la lista a los autorizados oficiales del sistema"
            >
              <RotateCcw className="w-3.5 h-3.5 text-amber-300" />
              <span>Restablecer Oficiales</span>
            </button>
            <button
              type="button"
              onClick={handleAbrirCrear}
              className="px-4 py-2.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black rounded-xl text-xs font-sans uppercase tracking-wider transition shadow-lg flex items-center gap-2 cursor-pointer"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>Nuevo Autorizado (+)</span>
            </button>
          </div>
        </div>

        {/* TARJETAS DE MÉTRICAS */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-5 border-t border-emerald-800/40 relative z-10 text-xs">
          <div className="p-3 bg-white/10 rounded-2xl border border-white/10 flex items-center justify-between">
            <div>
              <span className="text-[10px] uppercase font-bold text-emerald-200 block font-mono">Total Registros</span>
              <span className="text-xl font-bold font-mono text-white">{stats.total}</span>
            </div>
            <ShieldCheck className="w-6 h-6 text-emerald-300 opacity-80" />
          </div>

          <div className="p-3 bg-white/10 rounded-2xl border border-white/10 flex items-center justify-between">
            <div>
              <span className="text-[10px] uppercase font-bold text-emerald-200 block font-mono">Clientes Habilitados</span>
              <span className="text-xl font-bold font-mono text-white">{stats.clientes}</span>
            </div>
            <Building2 className="w-6 h-6 text-sky-300 opacity-80" />
          </div>

          <div className="p-3 bg-white/10 rounded-2xl border border-white/10 flex items-center justify-between">
            <div>
              <span className="text-[10px] uppercase font-bold text-emerald-200 block font-mono">Despachantes</span>
              <span className="text-xl font-bold font-mono text-amber-300">{stats.despachantes}</span>
            </div>
            <UserCheck className="w-6 h-6 text-amber-300 opacity-80" />
          </div>

          <div className="p-3 bg-white/10 rounded-2xl border border-white/10 flex items-center justify-between">
            <div>
              <span className="text-[10px] uppercase font-bold text-emerald-200 block font-mono">Administradores</span>
              <span className="text-xl font-bold font-mono text-white">{stats.admins}</span>
            </div>
            <ShieldAlert className="w-6 h-6 text-purple-300 opacity-80" />
          </div>
        </div>
      </div>

      {/* BARRA DE FILTROS & BÚSQUEDA */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-gray-200 shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-4 gap-3 text-xs">
          {/* Búsqueda */}
          <div className="sm:col-span-2 lg:col-span-2 relative">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400 pointer-events-none">
              <Search className="w-4 h-4" />
            </span>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por nombre, cliente comitente o email..."
              className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#00603C] text-xs font-medium text-gray-800"
            />
          </div>

          {/* Filtro Tipo */}
          <div>
            <select
              value={filterTipo}
              onChange={(e) => setFilterTipo(e.target.value as any)}
              className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#00603C] text-xs font-bold text-gray-800"
            >
              <option value="TODOS">Todos los Tipos</option>
              <option value="CLIENTE">Solo Clientes</option>
              <option value="DESPACHANTE">Solo Despachantes</option>
              <option value="ADMIN">Solo Administradores</option>
            </select>
          </div>

          {/* Filtro Estado */}
          <div>
            <select
              value={filterEstado}
              onChange={(e) => setFilterEstado(e.target.value as any)}
              className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#00603C] text-xs font-bold text-gray-800"
            >
              <option value="TODOS">Todos los Estados</option>
              <option value="HABILITADO">Habilitados</option>
              <option value="DESHABILITADO">Deshabilitados</option>
            </select>
          </div>
        </div>

        <div className="flex items-center justify-between text-[11px] text-gray-500 pt-1 border-t border-gray-100">
          <span>
            Mostrando <strong>{itemsFiltrados.length}</strong> de <strong>{autorizados.length}</strong> usuarios autorizados
          </span>
          <span className="text-emerald-700 font-medium font-mono">
            Matías Green asignado a Stine: <strong>Habilitado</strong>
          </span>
        </div>
      </div>

      {/* TABLA DE USUARIOS AUTORIZADOS */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
        {itemsFiltrados.length === 0 ? (
          <div className="p-12 text-center text-gray-400 space-y-3">
            <UserCheck className="w-12 h-12 mx-auto text-gray-300 stroke-[1.5]" />
            <h4 className="font-serif text-base font-bold text-gray-700">Sin Registros Encontrados</h4>
            <p className="text-xs max-w-md mx-auto text-gray-500">
              No existen autorizados que coincidan con los filtros aplicados.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-gray-50/80 border-b border-gray-200 text-gray-500 font-mono uppercase tracking-wider">
                  <th className="p-3.5">Nombre / Razón Social</th>
                  <th className="p-3.5">Rol / Tipo</th>
                  <th className="p-3.5">Cliente Asignado</th>
                  <th className="p-3.5">Correo Electrónico</th>
                  <th className="p-3.5">Estado</th>
                  <th className="p-3.5">Observaciones</th>
                  <th className="p-3.5 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {itemsFiltrados.map((item) => {
                  const isMatiasGreen = item.nombre.toLowerCase().includes('green');

                  return (
                    <tr
                      key={item.id}
                      className={`hover:bg-gray-50/70 transition ${
                        isMatiasGreen ? 'bg-amber-50/30' : ''
                      }`}
                    >
                      {/* Nombre */}
                      <td className="p-3.5 font-bold text-gray-900">
                        <div className="flex items-center gap-2">
                          <span>{item.nombre}</span>
                          {isMatiasGreen && (
                            <span className="text-[10px] font-mono font-bold bg-amber-400 text-slate-950 px-2 py-0.5 rounded shadow-2xs">
                              ⭐ Stine Oficial
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] font-mono text-gray-400 font-normal">ID: {item.id}</span>
                      </td>

                      {/* Tipo */}
                      <td className="p-3.5 font-mono">
                        {item.tipo === 'CLIENTE' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-800 border border-blue-200">
                            <Building2 className="w-3 h-3" />
                            Cliente
                          </span>
                        )}
                        {item.tipo === 'DESPACHANTE' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-900 border border-amber-200">
                            <User className="w-3 h-3" />
                            Despachante
                          </span>
                        )}
                        {item.tipo === 'ADMIN' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-900 border border-purple-200">
                            <ShieldCheck className="w-3 h-3" />
                            Administrador
                          </span>
                        )}
                      </td>

                      {/* Cliente Asignado */}
                      <td className="p-3.5 font-semibold text-gray-800">
                        {item.clienteAsignado ? (
                          <span className="bg-emerald-50 text-[#00603C] px-2 py-0.5 rounded border border-emerald-200 font-bold">
                            {item.clienteAsignado}
                          </span>
                        ) : (
                          <span className="text-gray-400 font-mono">—</span>
                        )}
                      </td>

                      {/* Email */}
                      <td className="p-3.5 text-gray-600 font-mono text-[11px]">
                        {item.email ? (
                          <div className="flex items-center gap-1">
                            <Mail className="w-3.5 h-3.5 text-gray-400" />
                            <span>{item.email}</span>
                          </div>
                        ) : (
                          <span className="text-gray-400 italic">Sin correo registrado</span>
                        )}
                      </td>

                      {/* Estado */}
                      <td className="p-3.5">
                        <button
                          type="button"
                          onClick={() => handleToggleHabilitado(item)}
                          className="cursor-pointer inline-flex items-center gap-1.5 focus:outline-none"
                          title="Hacer clic para alternar habilitación"
                        >
                          {item.habilitado ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                              <Check className="w-3 h-3 stroke-[3]" />
                              Habilitado
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
                              <X className="w-3 h-3 stroke-[3]" />
                              Deshabilitado
                            </span>
                          )}
                        </button>
                      </td>

                      {/* Observaciones */}
                      <td className="p-3.5 text-gray-500 text-[11px] max-w-[200px] truncate" title={item.observaciones}>
                        {item.observaciones || '—'}
                      </td>

                      {/* Acciones */}
                      <td className="p-3.5 text-right space-x-1 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => handleAbrirEditar(item)}
                          className="p-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition cursor-pointer"
                          title="Editar datos"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteItem(item)}
                          className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg transition cursor-pointer"
                          title="Eliminar de la lista"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL: ALTA Y EDICIÓN DE AUTORIZADO DE PARKING */}
      {modalItem && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={(e) => {
            if (e.target === e.currentTarget && !isSaving) setModalItem(null);
          }}
        >
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-gray-200 overflow-hidden flex flex-col text-left">
            <div className="bg-gradient-to-r from-emerald-950 via-[#00603C] to-[#1c3a26] text-white p-5 border-b border-emerald-800/40 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-white/10 rounded-xl">
                  <UserCheck className="w-5 h-5 text-amber-300" />
                </div>
                <div>
                  <h3 className="font-serif font-bold text-lg text-white">
                    {isEditing ? 'Editar Autorizado de Parking' : 'Nuevo Autorizado para Parking'}
                  </h3>
                  <p className="text-xs text-emerald-200 font-sans">
                    Gestión de acceso habilitado a turnos y órdenes de precarga
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={isSaving}
                onClick={() => setModalItem(null)}
                className="p-1.5 text-white/80 hover:text-white bg-white/10 hover:bg-white/20 rounded-xl transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleGuardarModal} className="p-5 sm:p-6 space-y-4 text-xs">
              {formError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 font-bold">
                  {formError}
                </div>
              )}

              {/* Nombre Completo */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase font-mono tracking-wider mb-1">
                  Nombre Completo o Razón Social <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={modalItem.nombre || ''}
                  onChange={(e) => setModalItem(prev => ({ ...prev, nombre: e.target.value }))}
                  placeholder="ej: Matias Green o San Diego Semillas"
                  className="w-full px-3.5 py-2.5 bg-white border border-gray-300 rounded-xl text-xs font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#00603C]"
                />
              </div>

              {/* Tipo y Rol */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Tipo de Usuario <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={modalItem.tipo || 'DESPACHANTE'}
                    onChange={(e) => setModalItem(prev => ({ ...prev, tipo: e.target.value as any }))}
                    className="w-full px-3.5 py-2.5 bg-white border border-gray-300 rounded-xl text-xs font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#00603C]"
                  >
                    <option value="DESPACHANTE">Despachante</option>
                    <option value="CLIENTE">Cliente Comitente</option>
                    <option value="ADMIN">Administrador</option>
                  </select>
                </div>

                {/* Cliente Asignado */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Cliente Asignado
                  </label>
                  <input
                    type="text"
                    value={modalItem.clienteAsignado || ''}
                    onChange={(e) => setModalItem(prev => ({ ...prev, clienteAsignado: e.target.value }))}
                    placeholder="ej: Stine, Todos, etc."
                    className="w-full px-3.5 py-2.5 bg-white border border-gray-300 rounded-xl text-xs font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#00603C]"
                  />
                </div>
              </div>

              {/* Email para Notificaciones */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1 flex items-center justify-between">
                  <span>Correo Electrónico (Notificaciones de Turnos / Cancelaciones)</span>
                  <span className="text-[10px] text-gray-400 font-mono">(Opcional)</span>
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400 pointer-events-none">
                    <Mail className="w-4 h-4" />
                  </span>
                  <input
                    type="email"
                    value={modalItem.email || ''}
                    onChange={(e) => setModalItem(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="ej: matias.green@stine.com"
                    className="w-full pl-9 pr-3.5 py-2.5 bg-white border border-gray-300 rounded-xl text-xs font-mono text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#00603C]"
                  />
                </div>
              </div>

              {/* Observaciones */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Observaciones / Notas
                </label>
                <textarea
                  rows={2}
                  value={modalItem.observaciones || ''}
                  onChange={(e) => setModalItem(prev => ({ ...prev, observaciones: e.target.value }))}
                  placeholder="ej: Despachante oficial asignado a Stine"
                  className="w-full p-3 bg-white border border-gray-300 rounded-xl text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#00603C]"
                />
              </div>

              {/* Toggle Habilitado */}
              <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl flex items-center justify-between">
                <div>
                  <span className="font-bold text-gray-900 block text-xs">Acceso Habilitado</span>
                  <span className="text-[11px] text-gray-500">
                    Permite iniciar sesión en Parking y reservar turnos
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={modalItem.habilitado ?? true}
                  onChange={(e) => setModalItem(prev => ({ ...prev, habilitado: e.target.checked }))}
                  className="w-5 h-5 text-[#00603C] rounded focus:ring-[#00603C] cursor-pointer"
                />
              </div>

              <div className="pt-3 border-t border-gray-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => setModalItem(null)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold cursor-pointer transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2.5 bg-[#00603C] hover:bg-[#254731] text-white rounded-xl text-xs font-bold uppercase tracking-wider transition shadow-md flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <Save className="w-4 h-4 text-amber-300" />
                  <span>{isSaving ? 'Guardando...' : 'Guardar Autorizado'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
