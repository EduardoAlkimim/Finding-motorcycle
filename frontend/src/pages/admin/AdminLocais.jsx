import { useState, useEffect, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import Layout from '../../components/shared/Layout';
import { Map, BarChart3, MapPin, Bell, Plus, X, Pencil, Trash2, Loader2, CheckCircle2, Search } from 'lucide-react';
import { locais as locaisApi } from '../../services/api';

const NAV = [
  { href: '/admin',            label: 'Mapa ao vivo', icon: Map },
  { href: '/admin/relatorios', label: 'Relatórios',   icon: BarChart3 },
  { href: '/admin/locais',     label: 'Locais',       icon: MapPin },
  { href: '/admin/alertas',    label: 'Alertas',      icon: Bell, badge: true },
];

const LOJA = {
  lat: parseFloat(import.meta.env.VITE_LOJA_LAT || '-15.7942'),
  lng: parseFloat(import.meta.env.VITE_LOJA_LNG || '-47.8825'),
};

const criarIconePin = (cor = '#185FA5', label = '') => L.divIcon({
  html: `<div style="display:flex;flex-direction:column;align-items:center">
    <div style="background:${cor};color:#fff;border-radius:8px;padding:3px 9px;font-size:11px;font-weight:600;white-space:nowrap;border:2px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.25)">${label}</div>
    <div style="width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-top:6px solid ${cor};margin-top:-1px"></div>
  </div>`,
  className: '', iconAnchor: [0, 26],
});

const criarIconeLoja = () => L.divIcon({
  html: `<div style="background:#1f2937;color:#fff;border-radius:8px;padding:4px 10px;font-size:11px;font-family:'DM Sans',sans-serif;font-weight:600;white-space:nowrap;border:2px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.3)">🏪 Loja</div>`,
  className: '', iconAnchor: [30, 14],
});

function SeletorCoordenada({ onSelect }) {
  useMapEvents({
    click(e) { onSelect(e.latlng.lat, e.latlng.lng); },
  });
  return null;
}

const LOCAL_VAZIO = { nome: '', endereco: '', lat: '', lng: '' };

export default function AdminLocais() {
  const [locais, setLocais]     = useState([]);
  const [loading, setLoading]   = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [busca, setBusca]       = useState('');
  const [modal, setModal]       = useState(null); // null | 'novo' | {id,...}
  const [form, setForm]         = useState(LOCAL_VAZIO);
  const [pinTemp, setPinTemp]   = useState(null);
  const [erro, setErro]         = useState('');

  const carregar = useCallback(async () => {
    try {
      const data = await locaisApi.listar();
      setLocais(data);
    } catch (err) {
      console.error('Erro ao carregar locais:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  const abrirNovo = () => {
    setForm(LOCAL_VAZIO); setPinTemp(null); setErro(''); setModal('novo');
  };

  const abrirEditar = (local) => {
    setForm({ nome: local.nome, endereco: local.endereco, lat: String(local.lat), lng: String(local.lng) });
    setPinTemp({ lat: local.lat, lng: local.lng });
    setErro(''); setModal(local);
  };

  const fecharModal = () => { setModal(null); setPinTemp(null); };

  const selecionarNoPino = (lat, lng) => {
    setPinTemp({ lat, lng });
    setForm(prev => ({ ...prev, lat: lat.toFixed(6), lng: lng.toFixed(6) }));
  };

  const salvar = async () => {
    if (!form.nome.trim() || !form.endereco.trim() || !form.lat || !form.lng) {
      setErro('Preencha todos os campos.'); return;
    }
    const lat = parseFloat(form.lat);
    const lng = parseFloat(form.lng);
    if (isNaN(lat) || isNaN(lng)) { setErro('Latitude/longitude inválidas.'); return; }

    setSalvando(true); setErro('');
    try {
      if (modal === 'novo') {
        await locaisApi.criar({ nome: form.nome.trim(), endereco: form.endereco.trim(), lat, lng });
      } else {
        await locaisApi.atualizar(modal.id, { nome: form.nome.trim(), endereco: form.endereco.trim(), lat, lng });
      }
      await carregar();
      fecharModal();
    } catch (err) {
      setErro(err.message || 'Erro ao salvar.');
    } finally {
      setSalvando(false);
    }
  };

  const remover = async (id) => {
    if (!confirm('Remover este local?')) return;
    try {
      await locaisApi.remover(id);
      setLocais(prev => prev.filter(l => l.id !== id));
    } catch (err) {
      alert('Erro ao remover: ' + err.message);
    }
  };

  const locaisFiltrados = locais.filter(l =>
    l.nome.toLowerCase().includes(busca.toLowerCase()) ||
    l.endereco.toLowerCase().includes(busca.toLowerCase())
  );

  return (
    <Layout navItems={NAV}>
      <div className="bg-white border-b border-gray-100 px-5 py-3 flex items-center justify-between flex-shrink-0">
        <div>
          <h1 className="text-base font-semibold text-gray-900">Locais de entrega</h1>
          <p className="text-xs text-gray-400">{locais.length} local{locais.length !== 1 ? 'is' : ''} cadastrado{locais.length !== 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={abrirNovo}
          className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg font-medium bg-brand-500 text-white hover:bg-brand-600 transition-all"
        >
          <Plus size={13} /> Novo local
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Lista lateral */}
        <div className="w-[300px] flex-shrink-0 bg-white border-r border-gray-100 flex flex-col">
          <div className="p-3 border-b border-gray-100">
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={busca}
                onChange={e => setBusca(e.target.value)}
                placeholder="Buscar local…"
                className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-400"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto scrollbar-thin p-3 space-y-2">
            {loading && (
              <div className="flex items-center justify-center py-10">
                <Loader2 size={18} className="animate-spin text-gray-300" />
              </div>
            )}
            {!loading && locaisFiltrados.length === 0 && (
              <div className="flex flex-col items-center py-10 text-gray-400">
                <MapPin size={24} className="mb-2 text-gray-200" />
                <div className="text-xs">{busca ? 'Nenhum resultado' : 'Nenhum local cadastrado'}</div>
              </div>
            )}
            {locaisFiltrados.map(local => (
              <div key={local.id} className="border border-gray-100 rounded-xl p-3 hover:border-gray-200 transition-all group">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-gray-800 truncate">{local.nome}</div>
                    <div className="text-[10px] text-gray-400 mt-0.5 truncate">{local.endereco}</div>
                    <div className="text-[10px] text-gray-300 mt-1 font-mono">{local.lat.toFixed(5)}, {local.lng.toFixed(5)}</div>
                  </div>
                  <div className="flex items-center gap-1 ml-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => abrirEditar(local)} className="p-1 rounded-lg text-gray-400 hover:text-brand-500 hover:bg-brand-50 transition-colors">
                      <Pencil size={12} />
                    </button>
                    <button onClick={() => remover(local.id)} className="p-1 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors">
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Mapa */}
        <div className="flex-1 relative">
          <MapContainer center={[LOJA.lat, LOJA.lng]} zoom={13} style={{ width: '100%', height: '100%' }} zoomControl={true}>
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
              attribution='&copy; <a href="https://carto.com/">CARTO</a>'
              maxZoom={19}
            />
            <Marker position={[LOJA.lat, LOJA.lng]} icon={criarIconeLoja()}>
              <Popup><strong>🏪 Loja</strong><br />Ponto de origem</Popup>
            </Marker>
            {locais.map(local => (
              <Marker key={local.id} position={[local.lat, local.lng]} icon={criarIconePin('#185FA5', local.nome)}>
                <Popup>
                  <strong>{local.nome}</strong><br />{local.endereco}
                  <br />
                  <button
                    onClick={() => abrirEditar(local)}
                    style={{ fontSize: '11px', color: '#185FA5', cursor: 'pointer', border: 'none', background: 'none', padding: 0, marginTop: 4 }}
                  >✏️ Editar</button>
                </Popup>
              </Marker>
            ))}
          </MapContainer>

          <div className="absolute top-3 left-3 bg-white rounded-xl shadow-lg border border-gray-100 px-3 py-2 text-xs z-[400] text-gray-500">
            {locais.length} local{locais.length !== 1 ? 'is' : ''} no mapa
          </div>
        </div>
      </div>

      {/* Modal */}
      {modal !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col overflow-hidden max-h-[90vh]">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div>
                <h2 className="text-sm font-semibold text-gray-900">{modal === 'novo' ? 'Novo local' : 'Editar local'}</h2>
                <p className="text-[10px] text-gray-400 mt-0.5">Clique no mapa para definir a posição</p>
              </div>
              <button onClick={fecharModal} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
            </div>

            <div className="flex flex-col overflow-hidden flex-1">
              {/* Mini mapa */}
              <div className="h-48 relative flex-shrink-0">
                <MapContainer
                  center={pinTemp ? [pinTemp.lat, pinTemp.lng] : [LOJA.lat, LOJA.lng]}
                  zoom={14}
                  style={{ width: '100%', height: '100%' }}
                  zoomControl={false}
                >
                  <TileLayer
                    url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
                    attribution='&copy; CARTO'
                    maxZoom={19}
                  />
                  <SeletorCoordenada onSelect={selecionarNoPino} />
                  {pinTemp && (
                    <Marker position={[pinTemp.lat, pinTemp.lng]} icon={criarIconePin('#185FA5', form.nome || 'Novo local')}>
                      <Popup>{form.nome || 'Novo local'}</Popup>
                    </Marker>
                  )}
                  <Marker position={[LOJA.lat, LOJA.lng]} icon={criarIconeLoja()} />
                </MapContainer>
                <div className="absolute top-2 right-2 bg-white/90 backdrop-blur rounded-lg px-2 py-1 text-[10px] text-gray-500 z-[400] pointer-events-none">
                  📍 Clique para posicionar
                </div>
              </div>

              {/* Campos */}
              <div className="p-5 space-y-4 overflow-y-auto">
                {erro && (
                  <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl px-3 py-2">{erro}</div>
                )}

                <div>
                  <label className="block text-xs text-gray-500 mb-1.5">Nome do local</label>
                  <input
                    value={form.nome}
                    onChange={e => setForm(p => ({ ...p, nome: e.target.value }))}
                    placeholder="Ex: Oficina Central"
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-400"
                  />
                </div>

                <div>
                  <label className="block text-xs text-gray-500 mb-1.5">Endereço</label>
                  <input
                    value={form.endereco}
                    onChange={e => setForm(p => ({ ...p, endereco: e.target.value }))}
                    placeholder="Ex: Av. Principal, 100"
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-400"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1.5">Latitude</label>
                    <input
                      value={form.lat}
                      onChange={e => setForm(p => ({ ...p, lat: e.target.value }))}
                      placeholder="-15.794200"
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-400"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1.5">Longitude</label>
                    <input
                      value={form.lng}
                      onChange={e => setForm(p => ({ ...p, lng: e.target.value }))}
                      placeholder="-47.882500"
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-400"
                    />
                  </div>
                </div>

                <div className="flex gap-3 pt-1">
                  <button
                    onClick={fecharModal}
                    className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition-all"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={salvar}
                    disabled={salvando}
                    className="flex-1 flex items-center justify-center gap-2 bg-brand-500 disabled:opacity-40 hover:bg-brand-600 text-white py-2.5 rounded-xl text-sm font-medium transition-all"
                  >
                    {salvando ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                    {salvando ? 'Salvando…' : 'Salvar local'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}