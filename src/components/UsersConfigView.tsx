import React, { useState, useEffect } from 'react';
import { dbService } from '../services/db';
import type { ContractUser } from '../services/db';
import { UserPlus, Edit2, Trash2, ShieldCheck, Mail, User, Lock, AlertCircle, X, ShieldAlert } from 'lucide-react';

interface UsersConfigViewProps {
  currentUser: ContractUser;
  addToast: (text: string, type: 'success' | 'error') => void;
}

export const UsersConfigView: React.FC<UsersConfigViewProps> = ({ currentUser, addToast }) => {
  const [users, setUsers] = useState<ContractUser[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<ContractUser | null>(null);

  // Form Fields
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'Administrador' | 'Usuario'>('Administrador');

  const loadUsers = () => {
    setUsers(dbService.getUsers());
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const openAddModal = () => {
    setEditingUser(null);
    setName('');
    setUsername('');
    setEmail('');
    setPassword('');
    setRole('Administrador');
    setIsModalOpen(true);
  };

  const openEditModal = (user: ContractUser) => {
    setEditingUser(user);
    setName(user.name);
    setUsername(user.username);
    setEmail(user.email);
    setPassword(user.password || '');
    setRole(user.role);
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim() || !username.trim() || !email.trim() || !password.trim()) {
      addToast('Por favor complete todos los campos.', 'error');
      return;
    }

    const newUser: ContractUser = {
      id: editingUser ? editingUser.id : `user-${Math.random().toString(36).substring(2, 9)}`,
      name: name.trim(),
      username: username.trim().toLowerCase(),
      email: email.trim().toLowerCase(),
      password: password.trim(),
      role
    };

    dbService.saveUser(newUser)
      .then(() => {
        addToast(
          editingUser 
            ? `Usuario ${newUser.name} modificado con éxito.` 
            : `Usuario ${newUser.name} creado con éxito.`, 
          'success'
        );
        setIsModalOpen(false);
        loadUsers();
      })
      .catch(err => {
        console.error(err);
        addToast('Error al guardar el usuario en el sistema.', 'error');
      });
  };

  const handleDelete = (userToDelete: ContractUser) => {
    if (userToDelete.id === currentUser.id) {
      addToast('No puede eliminar su propia cuenta activa.', 'error');
      return;
    }

    const confirmDel = window.confirm(`¿Está seguro de eliminar el usuario "${userToDelete.name}" del sistema?`);
    if (!confirmDel) return;

    dbService.deleteUser(userToDelete.id)
      .then(() => {
        addToast(`Usuario ${userToDelete.name} eliminado del sistema.`, 'success');
        loadUsers();
      })
      .catch(err => {
        console.error(err);
        addToast('Error al eliminar usuario.', 'error');
      });
  };

  return (
    <div style={{ paddingBottom: '20px' }}>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="page-title-group">
          <h1>Control de Usuarios y Accesos</h1>
          <p>Gestione cuentas de Administrador y visualizadores con acceso restringido</p>
        </div>
        
        <button className="btn btn-primary" onClick={openAddModal}>
          <UserPlus size={16} />
          <span>Agregar Cuenta</span>
        </button>
      </div>

      {/* Warning Box */}
      <div className="glass table-card" style={{ padding: '16px 20px', marginBottom: '24px', display: 'flex', gap: '12px', alignItems: 'center' }}>
        <AlertCircle size={20} style={{ color: 'var(--primary)', flexShrink: 0 }} />
        <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
          <strong>Nota de Seguridad:</strong> Solo las cuentas de tipo <em>Administrador</em> requieren contraseña de acceso y tienen privilegios para editar disponibilidades, dotaciones y parámetros del contrato. Los usuarios de tipo <em>Usuario</em> acceden directamente en modo lectura.
        </span>
      </div>

      {/* Users list table */}
      <div className="glass table-card">
        <h2 className="chart-title" style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color)', margin: 0 }}>
          Cuentas Registradas en el Sistema
        </h2>
        
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Nombre Completo</th>
                <th>Usuario</th>
                <th>Email</th>
                <th style={{ textAlign: 'center' }}>Rol</th>
                <th style={{ width: '120px', textAlign: 'center' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id}>
                  <td style={{ fontWeight: '600' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{
                        background: u.role === 'Administrador' ? 'var(--primary-glow)' : 'rgba(0,0,0,0.03)',
                        color: u.role === 'Administrador' ? 'var(--primary-light)' : 'var(--text-secondary)',
                        width: '32px',
                        height: '32px',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: '700',
                        fontSize: '0.85rem'
                      }}>
                        {u.name.charAt(0).toUpperCase()}
                      </span>
                      <span>{u.name}</span>
                    </div>
                  </td>
                  <td><code>{u.username}</code></td>
                  <td>{u.email}</td>
                  <td style={{ textAlign: 'center' }}>
                    <span className={`badge badge-${u.role === 'Administrador' ? 'operativo' : 'mantencionpreventiva'}`}>
                      {u.role}
                    </span>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '8px' }}>
                      <button 
                        onClick={() => openEditModal(u)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--text-secondary)',
                          cursor: 'pointer',
                          padding: '4px',
                          display: 'flex',
                          alignItems: 'center'
                        }}
                        title="Editar cuenta"
                      >
                        <Edit2 size={15} />
                      </button>
                      <button 
                        onClick={() => handleDelete(u)}
                        disabled={u.id === currentUser.id}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: u.id === currentUser.id ? 'var(--text-muted)' : 'var(--color-mantencioncorrectiva)',
                          cursor: u.id === currentUser.id ? 'not-allowed' : 'pointer',
                          opacity: u.id === currentUser.id ? 0.3 : 1,
                          padding: '4px',
                          display: 'flex',
                          alignItems: 'center'
                        }}
                        title={u.id === currentUser.id ? 'No puede auto-eliminarse' : 'Eliminar cuenta'}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal dialog for creating/editing users */}
      {isModalOpen && (
        <div className="modal-backdrop" style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1100
        }}>
          <div className="glass modal-content" style={{
            width: '90%',
            maxWidth: '500px',
            background: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: '16px',
            boxShadow: 'var(--shadow-xl)',
            padding: '28px',
            color: 'var(--text-primary)',
            textAlign: 'left'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ShieldCheck size={20} style={{ color: 'var(--primary)' }} />
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: '700' }}>
                  {editingUser ? 'Modificar Cuenta' : 'Agregar Nueva Cuenta'}
                </h3>
              </div>
              <button 
                onClick={() => setIsModalOpen(false)} 
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '600', marginBottom: '6px', color: 'var(--text-secondary)' }}>
                  Nombre Completo
                </label>
                <div style={{ position: 'relative' }}>
                  <User size={16} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-muted)' }} />
                  <input 
                    type="text" 
                    placeholder="ej: Andrés Alquinta"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 12px 10px 38px',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color)',
                      background: 'var(--bg-input)',
                      color: 'var(--text-input)',
                      fontSize: '0.9rem'
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '600', marginBottom: '6px', color: 'var(--text-secondary)' }}>
                    Nombre de Usuario
                  </label>
                  <input 
                    type="text" 
                    placeholder="ej: andres.alquinta"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    disabled={!!editingUser}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color)',
                      background: editingUser ? 'rgba(0,0,0,0.03)' : 'var(--bg-input)',
                      color: editingUser ? 'var(--text-muted)' : 'var(--text-input)',
                      fontSize: '0.9rem',
                      cursor: editingUser ? 'not-allowed' : 'text'
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '600', marginBottom: '6px', color: 'var(--text-secondary)' }}>
                    Rol de Sistema
                  </label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value as any)}
                    disabled={editingUser?.id === currentUser.id}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color)',
                      background: 'var(--bg-input)',
                      color: 'var(--text-input)',
                      fontSize: '0.9rem',
                      height: '40px'
                    }}
                  >
                    <option value="Administrador">Administrador</option>
                    <option value="Usuario">Usuario (Visualizador)</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '600', marginBottom: '6px', color: 'var(--text-secondary)' }}>
                  Correo Electrónico
                </label>
                <div style={{ position: 'relative' }}>
                  <Mail size={16} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-muted)' }} />
                  <input 
                    type="email" 
                    placeholder="ej: andres@enaex.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 12px 10px 38px',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color)',
                      background: 'var(--bg-input)',
                      color: 'var(--text-input)',
                      fontSize: '0.9rem'
                    }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '600', marginBottom: '6px', color: 'var(--text-secondary)' }}>
                  Contraseña de Acceso
                </label>
                <div style={{ position: 'relative' }}>
                  <Lock size={16} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-muted)' }} />
                  <input 
                    type="password" 
                    placeholder="Contraseña"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 12px 10px 38px',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color)',
                      background: 'var(--bg-input)',
                      color: 'var(--text-input)',
                      fontSize: '0.9rem'
                    }}
                  />
                </div>
              </div>

              {editingUser?.id === currentUser.id && (
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center', background: 'var(--primary-glow)', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--primary-light)' }}>
                  <ShieldAlert size={14} style={{ color: 'var(--primary-light)', flexShrink: 0 }} />
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                    Está modificando su propia cuenta. No se permite cambiar su rol para evitar deslogueos fortuitos.
                  </span>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '12px' }}>
                <button 
                  type="button" 
                  className="btn btn-secondary btn-sm"
                  onClick={() => setIsModalOpen(false)}
                  style={{ height: '38px', padding: '0 16px' }}
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary btn-sm"
                  style={{ height: '38px', padding: '0 16px' }}
                >
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
