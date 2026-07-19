import React from 'react';
import { dbService } from '../services/db';
import { HelpCircle, Shield, Award, Users, FileText } from 'lucide-react';

export const MethodologyView: React.FC = () => {
  const kpisList = dbService.getContractKPIs();
  
  const getWeight = (id: string) => kpisList.find(k => k.id === id)?.weight ?? 0;
  const getKpiMin = (id: string) => kpisList.find(k => k.id === id)?.minVal ?? '';
  const getKpiExpected = (id: string) => kpisList.find(k => k.id === id)?.expectedVal ?? '';
  const getKpiMax = (id: string) => kpisList.find(k => k.id === id)?.maxVal ?? '';

  return (
    <div style={{ paddingBottom: '20px' }}>
      <div className="page-header">
        <div className="page-title-group">
          <h1>Metodología y Fórmulas de KPIs de Contrato</h1>
          <p>Lógica de cálculo detallada, ponderaciones y reglas operativas vigentes en base al turno contractual de 12 horas</p>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        
        {/* Resumen del Contrato */}
        <div className="glass table-card" style={{ padding: '24px', display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
          <HelpCircle size={28} style={{ color: 'var(--primary)', flexShrink: 0, marginTop: '2px' }} />
          <div>
            <h3 style={{ margin: '0 0 8px 0', fontSize: '1.1rem', fontWeight: '700' }}>Auditoría de Contrato Enaex</h3>
            <p style={{ margin: 0, fontSize: '0.9rem', lineHeight: '1.6', color: 'var(--text-secondary)' }}>
              Este sistema evalúa de forma dinámica el desempeño del contrato de servicio para la faena Sierra Gorda. 
              La nota global del período se calcula en base a la ponderación acumulada de cuatro grandes categorías de KPIs. 
              Todos los cálculos de disponibilidad de la flota están diseñados y ejecutados considerando <strong>el turno contractual de 12 horas diarias</strong> (de 07:00 a 19:00 hrs).
            </p>
          </div>
        </div>

        {/* Categoria 1: Disponibilidad y Stock */}
        <div className="glass table-card" style={{ padding: '24px' }}>
          <h2 style={{ fontSize: '1.15rem', fontWeight: '700', color: 'var(--primary)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileText size={20} />
            <span>1. Disponibilidad de Flota y Materias Primas ({getWeight('kpi-camiones') + getWeight('kpi-cargadores') + getWeight('kpi-polvorines') + getWeight('kpi-insumos')}% peso total)</span>
          </h2>
          <div style={{ fontSize: '0.9rem', lineHeight: '1.6', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <p style={{ margin: 0 }}>
              Evalúa la disponibilidad de los equipos operativos comprometidos y el stock de seguridad del inventario en faena:
            </p>
            <ul style={{ margin: '0 0 12px 0', paddingLeft: '20px' }}>
              <li><strong>Disponibilidad de Camiones Fábrica ({getWeight('kpi-camiones')}%):</strong> Meta máxima: {getKpiMax('kpi-camiones')}.</li>
              <li><strong>Disponibilidad de Cargadores Frontales ({getWeight('kpi-cargadores')}%):</strong> Meta máxima: {getKpiMax('kpi-cargadores')}.</li>
              <li><strong>Disponibilidad de Polvorines Móviles ({getWeight('kpi-polvorines')}%):</strong> Meta máxima: {getKpiMax('kpi-polvorines')}.</li>
              <li><strong>Disponibilidad de Materias Primas ({getWeight('kpi-insumos')}%):</strong> Meta de stock diaria: {getKpiExpected('kpi-insumos')} ton (Mínimo aceptable: {getKpiMin('kpi-insumos')} ton).</li>
            </ul>
            <div style={{ background: 'var(--bg-main)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
              <strong style={{ display: 'block', marginBottom: '8px', color: 'var(--text-primary)' }}>Fórmulas de Cálculo (Base 12 Horas):</strong>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '0.85rem' }}>
                <div>
                  <strong>Disponibilidad Física (DF):</strong>
                  <code style={{ display: 'block', background: 'rgba(0,0,0,0.03)', padding: '6px', borderRadius: '4px', marginTop: '4px', fontFamily: 'monospace' }}>
                    DF = ((12 - Horas Fuera de Servicio) / 12) * 100
                  </code>
                </div>
                <div>
                  <strong>Disponibilidad Contractual (DC):</strong> Descuenta los tiempos de demora posteriores a la tronadura que no son imputables al equipo:
                  <code style={{ display: 'block', background: 'rgba(0,0,0,0.03)', padding: '6px', borderRadius: '4px', marginTop: '4px', fontFamily: 'monospace' }}>
                    DC = ((12 - (Horas Fuera de Servicio - Demora Post-Tronadura)) / 12) * 100
                  </code>
                </div>
                <div>
                  <strong>Cumplimiento de Materias Primas:</strong> Promedio del stock de Nitrato y Matriz respecto a la meta esperada ({getKpiExpected('kpi-insumos')} ton), topado al 100%:
                  <code style={{ display: 'block', background: 'rgba(0,0,0,0.03)', padding: '6px', borderRadius: '4px', marginTop: '4px', fontFamily: 'monospace' }}>
                    Cumplimiento Diario = (Min(100, (Stock Real Nitrato / {getKpiExpected('kpi-insumos')}) * 100) + Min(100, (Stock Real Matriz / {getKpiExpected('kpi-insumos')}) * 100)) / 2
                  </code>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Categoria 2: Calidad de Servicio */}
        <div className="glass table-card" style={{ padding: '24px' }}>
          <h2 style={{ fontSize: '1.15rem', fontWeight: '700', color: 'var(--secondary)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Award size={20} />
            <span>2. Evaluación de Calidad de Servicio ({getWeight('kpi-innovacion') + getWeight('kpi-costos') + getWeight('kpi-horario-tronadura') + getWeight('kpi-programa-tronadura') + getWeight('kpi-p80') + getWeight('kpi-criterios-danio') + getWeight('kpi-tiros-quedados') + getWeight('kpi-ptq') + getWeight('kpi-flyrock') + getWeight('kpi-vod') + getWeight('kpi-gases')}% peso total)</span>
          </h2>
          <div style={{ fontSize: '0.9rem', lineHeight: '1.6', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <p style={{ margin: 0 }}>
              Mide el cumplimiento técnico y operativo en la faena. Los 5 indicadores basados en eventos se calculan automáticamente ingresando su valor real:
            </p>
            <ul style={{ margin: '0 0 12px 0', paddingLeft: '20px' }}>
              <li><strong>Tiros Quedados (TQ) ({getWeight('kpi-tiros-quedados')}%):</strong> 0 eventos = 100% | 1 o más = 0% cumplimiento.</li>
              <li><strong>Benchmark PTQ ({getWeight('kpi-ptq')}%):</strong> ≤3 unidades = 100% | 4 unidades = 75% | ≥5 = 0% cumplimiento.</li>
              <li><strong>Impacto por Flyrock ({getWeight('kpi-flyrock')}%):</strong> 0 impactos = 100% | 1 o más = 0% cumplimiento.</li>
              <li><strong>VOD en Productos ({getWeight('kpi-vod')}%):</strong> ≥8 unidades = 100% | 6 a 7 = 75% | 4 a 5 = 50% | ≤3 = 0% cumplimiento.</li>
              <li><strong>Gases Nitrosos ({getWeight('kpi-gases')}%):</strong> ≤1 evento = 100% | ≥2 eventos = 0% cumplimiento.</li>
              <li><strong>Otros KPIs (Ingreso Directo %):</strong> Innovación ({getWeight('kpi-innovacion')}%), Costos ({getWeight('kpi-costos')}%), Horario de Tronadura ({getWeight('kpi-horario-tronadura')}%), Programa de Tronadura ({getWeight('kpi-programa-tronadura')}%), Parámetros de P80 ({getWeight('kpi-p80')}%), Criterios de Daño ({getWeight('kpi-criterios-danio')}%).</li>
            </ul>
          </div>
        </div>

        {/* Categoria 3: Dotación */}
        <div className="glass table-card" style={{ padding: '24px' }}>
          <h2 style={{ fontSize: '1.15rem', fontWeight: '700', color: 'var(--color-mantencionpreventiva)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Users size={20} />
            <span>3. Evaluación de Dotación Semanal ({getWeight('kpi-dotacion-comprometida')}% peso total)</span>
          </h2>
          <div style={{ fontSize: '0.9rem', lineHeight: '1.6', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <p style={{ margin: 0 }}>
              Calcula la asistencia efectiva del personal comprometido en el período (medido en ciclos semanales de miércoles a martes):
            </p>
            <div style={{ background: 'var(--bg-main)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
              <strong style={{ display: 'block', marginBottom: '8px', color: 'var(--text-primary)' }}>Reglas y Filtros de Contrato:</strong>
              <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '0.85rem' }}>
                <li><strong>Exclusión de Cargos Planta:</strong> Los cargos extras costeados por Enaex que tienen desactivado "Afecta KPI" se omiten de toda la estadística.</li>
                <li><strong>Personal en Roster 4x3:</strong> Solo laboran de lunes a jueves. Los viernes, sábados y domingos se excluyen automáticamente de los requerimientos y asistencias diarias del cálculo.</li>
                <li><strong>Personal en Roster 7x7:</strong> Se divide su dotación teórica entre 2, considerando solo la cohorte activa en turno diario.</li>
                <li>
                  <strong>Fórmula de Asistencia:</strong>
                  <code style={{ display: 'block', background: 'rgba(0,0,0,0.03)', padding: '6px', borderRadius: '4px', marginTop: '4px', fontFamily: 'monospace' }}>
                    Asistencia = (Suma Asistencia Real Diaria / Suma Dotación Contractual Requerida) * 100
                  </code>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Categoria 4: Seguridad */}
        <div className="glass table-card" style={{ padding: '24px' }}>
          <h2 style={{ fontSize: '1.15rem', fontWeight: '700', color: '#10b981', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Shield size={20} />
            <span>4. Evaluación de Seguridad ({getWeight('kpi-seg-trirf') + getWeight('kpi-seg-notrirf') + getWeight('kpi-seg-legal') + getWeight('kpi-seg-auditorias') + getWeight('kpi-seg-incumplimiento')}% peso total)</span>
          </h2>
          <div style={{ fontSize: '0.9rem', lineHeight: '1.6', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <p style={{ margin: 0 }}>
              Pondera la tolerancia y penalizaciones del contrato respecto a los incidentes y desvíos SSMA en el período:
            </p>
            <ul style={{ margin: 0, paddingLeft: '20px' }}>
              <li><strong>Incidentes TRIRF ({getWeight('kpi-seg-trirf')}%):</strong> 0 incidentes = 100% | 1 = 50% | ≥2 = 0% cumplimiento.</li>
              <li><strong>Incidentes No TRIRF ({getWeight('kpi-seg-notrirf')}%):</strong> 0 = 100% | 1 = 75% | 2 = 50% | ≥3 = 0% cumplimiento.</li>
              <li><strong>Cumplimiento Legal ({getWeight('kpi-seg-legal')}%):</strong> 0 desvíos = 100% | 1 = 75% | 2 = 50% | ≥3 = 0% cumplimiento.</li>
              <li><strong>Auditorías ({getWeight('kpi-seg-auditorias')}%):</strong> Calificación de auditoría ≥90% = 100% | ≥70% = 75% | ≥26% = 50% | &lt;26% = 0% cumplimiento.</li>
              <li><strong>Incumplimiento SSMA ({getWeight('kpi-seg-incumplimiento')}%):</strong> 0 desvíos = 100% | 1-2 desvíos = 75% | 3-4 desvíos = 50% | ≥5 = 0% cumplimiento.</li>
            </ul>
          </div>
        </div>

      </div>
    </div>
  );
};
