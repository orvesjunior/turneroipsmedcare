// Servidor para sistema de llamado de pacientes
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Servir archivos estáticos (HTML, CSS, JS)
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// Archivo para guardar la configuración de consultorios
const consultoriosFile = path.join(__dirname, 'data', 'consultorios.json');
// Archivo para guardar las recepciones
const recepcionesFile = path.join(__dirname, 'data', 'recepciones.json');

// Crear directorio de datos si no existe
if (!fs.existsSync(path.join(__dirname, 'data'))) {
  fs.mkdirSync(path.join(__dirname, 'data'));
}

// Información de consultorios (por defecto, se cargará desde archivo si existe)
let consultorios = {
  1: "Consultorio 1 - Dr. García - Planta Baja",
  2: "Consultorio 2 - Dra. Rodríguez - Primer Piso",
  3: "Consultorio 3 - Dr. Martínez - Planta Baja",
  4: "Laboratorio - Segundo Piso",
  5: "Radiología - Sótano"
};

// Información de recepciones
let recepciones = {
  1: {
    id: 1, 
    nombre: "Recepción General", 
    consultorios: [1, 2, 3, 4, 5] // Esta recepción maneja todos los consultorios por defecto
  },
  2: {
    id: 2, 
    nombre: "Recepción Especialidades", 
    consultorios: [3, 4, 5] // Esta recepción maneja solo algunos consultorios
  },
  3: {
    id: 3, 
    nombre: "Recepción Consulta Externa", 
    consultorios: [1, 2] // Esta recepción maneja solo consultorios 1 y 2
  }
};

// Cargar consultorios desde archivo si existe
if (fs.existsSync(consultoriosFile)) {
  try {
    const data = fs.readFileSync(consultoriosFile, 'utf8');
    consultorios = JSON.parse(data);
    console.log('Consultorios cargados desde archivo');
  } catch (err) {
    console.error('Error al cargar consultorios:', err);
  }
} else {
  // Guardar configuración inicial
  try {
    fs.writeFileSync(consultoriosFile, JSON.stringify(consultorios, null, 2), 'utf8');
    console.log('Archivo de consultorios creado con valores iniciales');
  } catch (err) {
    console.error('Error al crear archivo de consultorios:', err);
  }
}

// Cargar recepciones desde archivo si existe
if (fs.existsSync(recepcionesFile)) {
  try {
    const data = fs.readFileSync(recepcionesFile, 'utf8');
    recepciones = JSON.parse(data);
    console.log('Recepciones cargadas desde archivo');
  } catch (err) {
    console.error('Error al cargar recepciones:', err);
  }
} else {
  // Guardar configuración inicial
  try {
    fs.writeFileSync(recepcionesFile, JSON.stringify(recepciones, null, 2), 'utf8');
    console.log('Archivo de recepciones creado con valores iniciales');
  } catch (err) {
    console.error('Error al crear archivo de recepciones:', err);
  }
}

// Lista de pacientes en espera (simulación de base de datos)
let pacientesEnEspera = [
  { id: 1, nombre: "María López", ticket: "N-001", consultorio: 1, tipoPaciente: "N", recepcion: 1 },
  { id: 2, nombre: "Juan Pérez", ticket: "N-002", consultorio: 2, tipoPaciente: "N", recepcion: 1 },
  { id: 3, nombre: "Carlos Ramírez", ticket: "N-003", consultorio: 3, tipoPaciente: "N", recepcion: 2 },
  { id: 4, nombre: "Ana Gómez", ticket: "N-004", consultorio: 4, tipoPaciente: "N", recepcion: 2 }
];

// Archivo para guardar los contadores de tickets
const contadoresFile = path.join(__dirname, 'data', 'contadores.json');

// Contadores para los diferentes tipos de tickets
let contadorTickets = {
  'N': 5, // Normal (empezamos en 5 porque ya tenemos 4 pacientes)
  'T': 1, // Tercera Edad
  'M': 1, // Menor de Edad
  'P': 1  // Particular
};

// Cargar contadores desde archivo si existe
if (fs.existsSync(contadoresFile)) {
  try {
    const data = fs.readFileSync(contadoresFile, 'utf8');
    contadorTickets = JSON.parse(data);
    console.log('Contadores de tickets cargados desde archivo');
  } catch (err) {
    console.error('Error al cargar contadores:', err);
  }
} else {
  // Guardar configuración inicial
  try {
    fs.writeFileSync(contadoresFile, JSON.stringify(contadorTickets, null, 2), 'utf8');
    console.log('Archivo de contadores creado con valores iniciales');
  } catch (err) {
    console.error('Error al crear archivo de contadores:', err);
  }
}

// Función para guardar contadores
function guardarContadores() {
  try {
    fs.writeFileSync(contadoresFile, JSON.stringify(contadorTickets, null, 2), 'utf8');
  } catch (err) {
    console.error('Error al guardar contadores:', err);
  }
}

// Función para guardar recepciones
function guardarRecepciones() {
  try {
    fs.writeFileSync(recepcionesFile, JSON.stringify(recepciones, null, 2), 'utf8');
  } catch (err) {
    console.error('Error al guardar recepciones:', err);
  }
}

// Variable para guardar el paciente actual en llamado
let pacienteActual = null;

// Configuración de Socket.IO
io.on('connection', (socket) => {
  console.log('Cliente conectado:', socket.id);
  
  // Enviar datos iniciales al cliente
  socket.emit('consultorios', consultorios);
  socket.emit('recepciones', recepciones);
  
  if (pacienteActual) {
    socket.emit('llamar-paciente', pacienteActual);
  }
  
  // Evento para seleccionar recepción
  socket.on('seleccionar-recepcion', (recepcionId) => {
    console.log(`Cliente seleccionó recepción: ${recepcionId}`);
    socket.join(`recepcion-${recepcionId}`);
    
    // Enviar solo los pacientes que correspondan a esta recepción
    if (recepcionId) {
      const recepcion = recepciones[recepcionId];
      if (recepcion) {
        // Si es una recepción válida, filtrar pacientes por los consultorios de esta recepción
        const pacientesFiltrados = pacientesEnEspera.filter(p => 
          recepcion.consultorios.includes(p.consultorio)
        );
        socket.emit('lista-pacientes', pacientesFiltrados);
      } else {
        // Si no es una recepción válida, enviar todos los pacientes
        socket.emit('lista-pacientes', pacientesEnEspera);
      }
    } else {
      // Si no se especifica una recepción, enviar todos los pacientes
      socket.emit('lista-pacientes', pacientesEnEspera);
    }
  });
  
  // Evento para seleccionar pantalla general (TV)
  socket.on('seleccionar-pantalla', (pantallaId) => {
    console.log(`Cliente seleccionó pantalla: ${pantallaId}`);
    socket.join(`pantalla-${pantallaId}`);
    
    // Si es una pantalla para un consultorio específico, filtrar por ese consultorio
    if (pantallaId && consultorios[pantallaId]) {
      const pacientesFiltrados = pacientesEnEspera.filter(p => p.consultorio === parseInt(pantallaId));
      socket.emit('lista-pacientes', pacientesFiltrados);
    } else {
      // Si es una pantalla general, enviar todos los pacientes
      socket.emit('lista-pacientes', pacientesEnEspera);
    }
  });
  
  // Evento para solicitar contadores actuales
  socket.on('solicitar-contadores', () => {
    socket.emit('contadores-tickets', contadorTickets);
  });
  
  // Evento para llamar a un paciente
  socket.on('llamar-paciente', (pacienteId) => {
    const paciente = pacientesEnEspera.find(p => p.id === pacienteId);
    
    if (paciente) {
      pacienteActual = paciente;
      
      // Enviar a clientes específicos según el consultorio
      io.to(`pantalla-${paciente.consultorio}`).emit('llamar-paciente', paciente);
      
      // También enviar a pantallas generales
      io.to('pantalla-general').emit('llamar-paciente', paciente);
      
      // Eliminar paciente de la lista de espera
      pacientesEnEspera = pacientesEnEspera.filter(p => p.id !== pacienteId);
      
      // Actualizar listas de pacientes para todos los clientes relevantes
      actualizarListasPacientes();
      
      console.log(`Paciente llamado: ${paciente.nombre}, Ticket: ${paciente.ticket}, Consultorio: ${paciente.consultorio}`);
    }
  });
  
  // Evento para agregar nuevo paciente
  socket.on('agregar-paciente', (nuevoPaciente) => {
    // Generar ID único
    const id = Date.now();
    const pacienteCompleto = { id, ...nuevoPaciente };
    
    // Actualizar contador si el ticket fue generado por el cliente
    if (nuevoPaciente.tipoPaciente && nuevoPaciente.ticket) {
      const tipo = nuevoPaciente.tipoPaciente;
      const numTicket = parseInt(nuevoPaciente.ticket.split('-')[1]);
      if (numTicket >= contadorTickets[tipo]) {
        contadorTickets[tipo] = numTicket + 1;
        guardarContadores();
      }
    }
    
    // Agregar a la lista de espera
    pacientesEnEspera.push(pacienteCompleto);
    
    // Actualizar listas de pacientes para todos los clientes relevantes
    actualizarListasPacientes();
    
    console.log(`Nuevo paciente agregado: ${nuevoPaciente.nombre}, Ticket: ${nuevoPaciente.ticket}, Recepción: ${nuevoPaciente.recepcion}`);
  });
  
  // Función para actualizar las listas de pacientes para todos los clientes relevantes
  function actualizarListasPacientes() {
    // Actualizar para cada recepción
    Object.keys(recepciones).forEach(recepcionId => {
      const recepcion = recepciones[recepcionId];
      const pacientesFiltrados = pacientesEnEspera.filter(p => 
        recepcion.consultorios.includes(p.consultorio)
      );
      io.to(`recepcion-${recepcionId}`).emit('lista-pacientes', pacientesFiltrados);
    });
    
    // Actualizar para cada pantalla específica de consultorio
    Object.keys(consultorios).forEach(consultorioId => {
      const pacientesFiltrados = pacientesEnEspera.filter(p => p.consultorio === parseInt(consultorioId));
      io.to(`pantalla-${consultorioId}`).emit('lista-pacientes', pacientesFiltrados);
    });
    
    // Actualizar para pantallas generales
    io.to('pantalla-general').emit('lista-pacientes', pacientesEnEspera);
  }
  
  // Evento para actualizar consultorio
  socket.on('actualizar-consultorio', (data) => {
    const { id, nombre } = data;
    
    if (id && nombre) {
      // Actualizar en memoria
      consultorios[id] = nombre;
      
      // Guardar en archivo
      try {
        fs.writeFileSync(consultoriosFile, JSON.stringify(consultorios, null, 2), 'utf8');
        console.log(`Consultorio ${id} actualizado: ${nombre}`);
      } catch (err) {
        console.error('Error al guardar consultorios:', err);
      }
      
      // Notificar a todos los clientes
      io.emit('consultorios', consultorios);
    }
  });
  
  // Evento para agregar nuevo consultorio
  socket.on('agregar-consultorio', (nombre) => {
    // Encontrar el siguiente ID disponible
    const ids = Object.keys(consultorios).map(id => parseInt(id));
    const nextId = ids.length > 0 ? Math.max(...ids) + 1 : 1;
    
    // Agregar consultorio
    consultorios[nextId] = nombre;
    
    // Guardar en archivo
    try {
      fs.writeFileSync(consultoriosFile, JSON.stringify(consultorios, null, 2), 'utf8');
      console.log(`Nuevo consultorio agregado (${nextId}): ${nombre}`);
    } catch (err) {
      console.error('Error al guardar consultorios:', err);
    }
    
    // Notificar a todos los clientes
    io.emit('consultorios', consultorios);
  });
  
  // Evento para eliminar consultorio
  socket.on('eliminar-consultorio', (id) => {
    if (consultorios[id]) {
      // Verificar si hay pacientes asignados a este consultorio
      const pacientesAfectados = pacientesEnEspera.filter(p => p.consultorio === parseInt(id));
      if (pacientesAfectados.length > 0) {
        socket.emit('error-eliminar-consultorio', {
          mensaje: 'No se puede eliminar el consultorio porque hay pacientes asignados a él',
          consultorioId: id
        });
        return;
      }
      
      // Eliminar consultorio
      delete consultorios[id];
      
      // Guardar en archivo
      try {
        fs.writeFileSync(consultoriosFile, JSON.stringify(consultorios, null, 2), 'utf8');
        console.log(`Consultorio ${id} eliminado`);
      } catch (err) {
        console.error('Error al guardar consultorios:', err);
      }
      
      // Notificar a todos los clientes
      io.emit('consultorios', consultorios);
    }
  });
  
  // Evento para administrar recepciones
  
  // Agregar nueva recepción
  socket.on('agregar-recepcion', (datos) => {
    const { nombre, consultorios: consultoriosAsignados } = datos;
    if (nombre && Array.isArray(consultoriosAsignados)) {
      // Encontrar el siguiente ID disponible
      const ids = Object.keys(recepciones).map(id => parseInt(id));
      const nextId = ids.length > 0 ? Math.max(...ids) + 1 : 1;
      
      // Agregar recepción
      recepciones[nextId] = {
        id: nextId,
        nombre,
        consultorios: consultoriosAsignados.map(c => parseInt(c))
      };
      
      // Guardar en archivo
      guardarRecepciones();
      
      // Notificar a todos los clientes
      io.emit('recepciones', recepciones);
      console.log(`Nueva recepción agregada (${nextId}): ${nombre}`);
    }
  });
  
  // Actualizar recepción
  socket.on('actualizar-recepcion', (datos) => {
    const { id, nombre, consultorios: consultoriosAsignados } = datos;
    if (id && recepciones[id] && nombre && Array.isArray(consultoriosAsignados)) {
      // Actualizar recepción
      recepciones[id] = {
        id: parseInt(id),
        nombre,
        consultorios: consultoriosAsignados.map(c => parseInt(c))
      };
      
      // Guardar en archivo
      guardarRecepciones();
      
      // Notificar a todos los clientes
      io.emit('recepciones', recepciones);
      console.log(`Recepción ${id} actualizada: ${nombre}`);
    }
  });
  
  // Eliminar recepción
  socket.on('eliminar-recepcion', (id) => {
    if (recepciones[id]) {
      // Verificar si hay pacientes asignados a esta recepción
      const pacientesAfectados = pacientesEnEspera.filter(p => p.recepcion === parseInt(id));
      if (pacientesAfectados.length > 0) {
        socket.emit('error-eliminar-recepcion', {
          mensaje: 'No se puede eliminar la recepción porque hay pacientes asignados a ella',
          recepcionId: id
        });
        return;
      }
      
      // Eliminar recepción
      delete recepciones[id];
      
      // Guardar en archivo
      guardarRecepciones();
      
      // Notificar a todos los clientes
      io.emit('recepciones', recepciones);
      console.log(`Recepción ${id} eliminada`);
    }
  });
  
  // Evento para desconexión
  socket.on('disconnect', () => {
    console.log('Cliente desconectado:', socket.id);
  });
});

// Iniciar servidor
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Servidor ejecutándose en puerto ${PORT}`);
});
