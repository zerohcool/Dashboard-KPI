import React, { useState } from 'react';
import { dbService } from '../services/db';
import type { Equipment } from '../services/db';
import { getPluralType } from '../utils/calculations';
import { Plus, Trash2, Edit2, X } from 'lucide-react';

interface FleetViewProps {
  fleet: Equipment[];
  onFleetChanged: () => void;
  addToast: (text: string, type: 'success' | 'error') => void;
}

export const FleetView: React.FC<FleetViewProps> = ({ fleet, onFleetChanged, addToast }) => {
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string>('All');
  
  // Add Form State
  const [name, setName] = useState('');
  const [type, setType] = useState<Equipment['type']>('Camión Fábrica');
  const [patent, setPatent] = useState('');
  
  const [showAddForm, setShowAddForm] = useState(false);

  // Edit State
  const [editingEq, setEditingEq] = useState<Equipment | null>(null);
  const [editName, setEditName] = useState('');
  const [editType, setEditType] = useState<Equipment['type']>('Camión Fábrica');
  const [editPatent, setEditPatent] = useState('');

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      addToast('El nombre del equipo es obligatorio.', 'error');
      return;
    }
    
    // Duplicate check
    const duplicate = fleet.find(eq => eq.name.toLowerCase() === name.trim().toLowerCase());
    if (duplicate) {
      addToast(`Ya existe un equipo con el nombre "${name}".`, 'error');
      return;
    }

    dbService.addEquipment(name.trim().toUpperCase(), type, patent.trim().toUpperCase(), true);
    addToast(`Equipo ${name} registrado correctamente.`, 'success');
    
    // Reset form
    setName('');
    setPatent('');
    setShowAddForm(false);
    onFleetChanged();
  };

  const handleStartEdit = (eq: Equipment) => {
    setEditingEq(eq);
    setEditName(eq.name);
    setEditType(eq.type);
    setEditPatent(eq.patent || '');
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEq) return;
    if (!editName.trim()) {
      addToast('El nombre del equipo es obligatorio.', 'error');
      return;
    }

    // Duplicate check
    const duplicate = fleet.find(
      eq => eq.id !== editingEq.id && eq.name.toLowerCase() === editName.trim().toLowerCase()
    );
    if (duplicate) {
      addToast(`Ya existe otro equipo con el nombre "${editName}".`, 'error');
      return;
    }

    dbService.updateEquipment(
      editingEq.id,
      editName.trim().toUpperCase(),
      editType,
      editPatent.trim().toUpperCase(),
      true
    );

    addToast(`Equipo ${editName} actualizado correctamente.`, 'success');
    setEditingEq(null);
    onFleetChanged();
  };

  const handleDelete = (id: string, name: string) => {
    if (window.confirm(`¿Está seguro de eliminar el equipo "${name}"? Esto también eliminará todo su historial de registros.`)) {
      dbService.deleteEquipment(id);
      addToast(`Equipo ${name} eliminado.`, 'success');
      onFleetChanged();
    }
  };

  const filteredFleet = selectedTypeFilter === 'All' 
    ? fleet 
    : fleet.filter(eq => eq.type === selectedTypeFilter);

  const types: Equipment['type'][] = ['Camión Fábrica', 'Cargador Frontal', 'Polvorín Móvil', 'Camioneta'];

  const renderEquipmentCard = (eq: Equipment) => (
    <div key={eq.id} className="glass-interactive equipment-card">
      <div className="eq-header">
        <div>
          <span className="eq-type">{eq.type}</span>
          <h3 className="eq-name" style={{ marginTop: '4px' }}>{eq.name}</h3>
        </div>
      </div>
      
      <div className="eq-details" style={{ marginTop: '12px', marginBottom: '16px' }}>
        <div><strong>Patente:</strong> <code>{eq.patent || 'Sin registrar'}</code></div>
        <div><strong>ID Sistema:</strong> <code>{eq.id}</code></div>
      </div>

      <div className="eq-actions" style={{ display: 'flex', gap: '8px' }}>
        <button 
          className="btn btn-secondary btn-sm"
          onClick={() => handleStartEdit(eq)}
          style={{ padding: '6px 8px' }}
          title="Editar Equipo"
        >
          <Edit2 size={14} />
        </button>
        <button 
          className="btn btn-secondary btn-danger btn-sm"
          onClick={() => handleDelete(eq.id, eq.name)}
          style={{ padding: '6px 8px' }}
          title="Eliminar Equipo"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );

  const renderEmptyState = () => (
    <div className="glass table-card" style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '40px' }}>
      <p style={{ color: 'var(--text-secondary)' }}>No se encontraron equipos registrados para este filtro.</p>
    </div>
  );

  return (
    <div>
      <div className="page-header">
        <div className="page-title-group">
          <h1>Gestión de Flota</h1>
          <p>Registre y administre los vehículos de la Planta Sierra Gorda</p>
        </div>
        <button 
          className="btn btn-primary" 
          onClick={() => {
            setShowAddForm(!showAddForm);
            setEditingEq(null);
          }}
        >
          <Plus size={16} />
          <span>{showAddForm ? 'Cerrar Formulario' : 'Registrar Equipo'}</span>
        </button>
      </div>

      {/* Add New Equipment Form */}
      {showAddForm && (
        <div className="glass table-card" style={{ marginBottom: '24px', animation: 'slideIn 0.2s ease-out' }}>
          <h2 className="chart-title">Nuevo Equipo</h2>
          <form onSubmit={handleAdd}>
            <div className="form-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))' }}>
              <div className="form-group">
                <label className="form-label">Nombre / Código</label>
                <input
                  type="text"
                  placeholder="Ej: CF-07"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Tipo de Equipo</label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as Equipment['type'])}
                >
                  {types.map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Patente / Identificador</label>
                <input
                  type="text"
                  placeholder="Ej: XX-YY-ZZ"
                  value={patent}
                  onChange={(e) => setPatent(e.target.value)}
                />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '16px' }}>
              <button 
                type="button" 
                className="btn btn-secondary" 
                onClick={() => setShowAddForm(false)}
              >
                Cancelar
              </button>
              <button type="submit" className="btn btn-primary">
                Guardar Equipo
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Edit Equipment Modal / Overlay */}
      {editingEq && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          backgroundColor: 'rgba(0, 0, 0, 0.4)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          animation: 'slideIn 0.15s ease-out'
        }}>
          <div className="glass table-card" style={{ width: '90%', maxWidth: '600px', padding: '30px', position: 'relative' }}>
            <button 
              onClick={() => setEditingEq(null)}
              style={{
                position: 'absolute',
                top: '20px',
                right: '20px',
                background: 'none',
                border: 'none',
                color: 'var(--text-secondary)',
                cursor: 'pointer'
              }}
            >
              <X size={20} />
            </button>
            <h2 className="chart-title" style={{ marginBottom: '24px' }}>Editar Equipo: {editingEq.name}</h2>
            <form onSubmit={handleSaveEdit}>
              <div className="form-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))' }}>
                <div className="form-group">
                  <label className="form-label">Nombre / Código</label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Tipo de Equipo</label>
                  <select
                    value={editType}
                    onChange={(e) => setEditType(e.target.value as Equipment['type'])}
                  >
                    {types.map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Patente / Identificador</label>
                  <input
                    type="text"
                    value={editPatent}
                    onChange={(e) => setEditPatent(e.target.value)}
                  />
                </div>
              </div>
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '24px' }}>
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={() => setEditingEq(null)}
                >
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary">
                  Guardar Cambios
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Filter Toolbar */}
      <div className="glass filter-bar">
        <div className="filter-group">
          <span className="filter-label">Filtrar por Tipo</span>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button 
              className={`btn btn-sm ${selectedTypeFilter === 'All' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setSelectedTypeFilter('All')}
            >
              Todos ({fleet.length})
            </button>
            {types.map(t => {
              const count = fleet.filter(eq => eq.type === t).length;
              return (
                <button
                  key={t}
                  className={`btn btn-sm ${selectedTypeFilter === t ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setSelectedTypeFilter(t)}
                >
                  {getPluralType(t)} ({count})
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Fleet Cards Grid */}
      {selectedTypeFilter !== 'All' ? (
        <div className="equipments-grid">
          {filteredFleet.map(eq => renderEquipmentCard(eq))}
          {filteredFleet.length === 0 && renderEmptyState()}
        </div>
      ) : (
        types.map(t => {
          const typeFleet = fleet.filter(eq => eq.type === t);
          if (typeFleet.length === 0) return null;
          return (
            <div key={t} style={{ marginBottom: '32px' }}>
              <h2 
                className="chart-title" 
                style={{ 
                  marginBottom: '16px', 
                  paddingBottom: '8px', 
                  borderBottom: '1px solid var(--border-color)', 
                  fontSize: '1.2rem', 
                  fontWeight: '700',
                  color: 'var(--text-primary)'
                }}
              >
                {getPluralType(t)} ({typeFleet.length})
              </h2>
              <div className="equipments-grid" style={{ marginTop: '12px', marginBottom: '20px' }}>
                {typeFleet.map(eq => renderEquipmentCard(eq))}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
};
