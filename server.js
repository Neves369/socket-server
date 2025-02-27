const { Server } = require('socket.io');
const http = require('http');

const PORT = 3000;
const httpServer = http.createServer();
const io = new Server(httpServer, {
  cors: {
    origin: '*', // Permitir conexões de qualquer origem
  },
});

let waitingPlayer = null; // Jogador esperando uma partida
let battles = {}; // Armazena as batalhas ativas

io.on('connection', (socket) => {
  console.log('Cliente conectado:', socket.id);

  // Quando um jogador está pronto para batalhar
  socket.on('ready', (playerData) => {
    console.log(`Jogador pronto: ${socket.id}`, playerData);

    if (!waitingPlayer) {
      waitingPlayer = { id: socket.id, data: playerData };
      socket.emit('waiting', 'Aguardando outro jogador...');
    } else {
      const opponent = waitingPlayer;
      const battleId = `${opponent.id}-${socket.id}`;
      
      // Escolher aleatoriamente quem começa
      const firstTurnPlayer = Math.random() < 0.5 ? opponent.id : socket.id;

      // Criar uma nova batalha
      battles[battleId] = {
        players: {
          [opponent.id]: opponent.data,
          [socket.id]: playerData,
        },
        turn: firstTurnPlayer, // Definir quem começa
      };

      // Enviar informações para os jogadores com `true` e `false`
      io.to(opponent.id).emit('startBattle', { battleId, opponent: playerData, myTurn: opponent.id === firstTurnPlayer });
      io.to(socket.id).emit('startBattle', { battleId, opponent: opponent.data, myTurn: socket.id === firstTurnPlayer });

      waitingPlayer = null; // Resetar para a próxima batalha
    }
  });

  // Receber ações durante a batalha
  socket.on('battleAction', ({ battleId, action }) => {
    if (!battles[battleId]) return;

    const battle = battles[battleId];
    const opponentId = Object.keys(battle.players).find(id => id !== socket.id);

    if (battle.turn !== socket.id) {
      socket.emit('error', 'Não é seu turno!');
      return;
    }

    // Enviar ação para o oponente
    io.to(opponentId).emit('battleAction', action);

    // Trocar turno
    battle.turn = opponentId;

    // Atualizar ambos os jogadores sobre o novo turno com `true` e `false`
    io.to(socket.id).emit('updateTurn', { myTurn: false });
    io.to(opponentId).emit('updateTurn', { myTurn: true });
  });

  // Trocar de pokemon
  socket.on('switch', ({ battleId, pokemon }) => {
      if (!battles[battleId]) return;
      console.log(`Ação recebida: ${battleId}`, pokemon);
  
      const battle = battles[battleId];
      const opponentId = Object.keys(battle.players).find(id => id !== socket.id);
  
      if (battle.turn !== socket.id) {
        socket.emit('error', 'Não é seu turno!');
        return;
      }
  
      // Enviar ação para o oponente
      io.to(opponentId).emit('switch', pokemon);
  
      // Trocar turno
      battle.turn = opponentId;
  
      // Atualizar ambos os jogadores sobre o novo turno com `true` e `false`
      io.to(socket.id).emit('updateTurn', { myTurn: false });
      io.to(opponentId).emit('updateTurn', { myTurn: true });
  });

  // Quando um jogador se desconectar
  socket.on('disconnect', () => {
    console.log('Cliente desconectado:', socket.id);
    
    // Remover o jogador das batalhas e alertar o oponente
    Object.keys(battles).forEach((battleId) => {
      if (battles[battleId].players[socket.id]) {
        const opponentId = Object.keys(battles[battleId].players).find(id => id !== socket.id);
        io.to(opponentId).emit('battleEnd', 'Seu oponente desconectou.');
        delete battles[battleId];
      }
    });

    // Se o jogador estava esperando, remover ele
    if (waitingPlayer?.id === socket.id) {
      waitingPlayer = null;
    }
  });
});

httpServer.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
