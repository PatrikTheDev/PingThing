import fastify from 'fastify';
import { consola } from 'consola';
import { IncidentDatabase } from './database.js';
import { parseArgs, createConfig } from './cli.js';

const app = fastify({ logger: false });

let database: IncidentDatabase;

app.get('/health', async () => {
  return { status: 'ok', timestamp: new Date().toISOString() };
});

app.get('/incidents', async (request, reply) => {
  try {
    const query = request.query as { limit?: string; host?: string };
    const limit = query.limit ? Number.parseInt(query.limit, 10) : 50;
    
    const incidents = query.host 
      ? database.getIncidentsByHost(query.host, limit)
      : database.getRecentIncidents(limit);
    
    return { incidents, count: incidents.length };
  } catch (error) {
    consola.error('Error fetching incidents:', error);
    return reply.code(500).send({ error: 'Failed to fetch incidents' });
  }
});

app.get('/incidents/unresolved', async (request, reply) => {
  try {
    const incidents = database.getUnresolvedIncidents();
    return { incidents, count: incidents.length };
  } catch (error) {
    consola.error('Error fetching unresolved incidents:', error);
    return reply.code(500).send({ error: 'Failed to fetch unresolved incidents' });
  }
});

app.patch('/incidents/:id/resolve', async (request, reply) => {
  try {
    const params = request.params as { id: string };
    const id = Number.parseInt(params.id, 10);
    
    if (Number.isNaN(id)) {
      return reply.code(400).send({ error: 'Invalid incident ID' });
    }
    
    const success = database.markIncidentResolved(id);
    
    if (success) {
      return { message: `Incident ${id} marked as resolved` };
    }
    
    return reply.code(404).send({ error: 'Incident not found' });
  } catch (error) {
    consola.error('Error resolving incident:', error);
    return reply.code(500).send({ error: 'Failed to resolve incident' });
  }
});

app.get('/statistics', async (request, reply) => {
  try {
    const stats = database.getStatistics();
    return stats;
  } catch (error) {
    consola.error('Error fetching statistics:', error);
    return reply.code(500).send({ error: 'Failed to fetch statistics' });
  }
});

app.get('/incidents/latest', async (request, reply) => {
  try {
    const incident = database.getLatestIncident();
    return incident ? { incident } : reply.code(404).send({ error: 'No incidents found' });
  } catch (error) {
    consola.error('Error fetching latest incident:', error);
    return reply.code(500).send({ error: 'Failed to fetch latest incident' });
  }
});

app.delete('/incidents', async (request, reply) => {
  try {
    const success = database.clearAllIncidents();
    if (success) {
      return { message: 'All incidents cleared successfully' };
    }
    return reply.code(500).send({ error: 'Failed to clear incidents' });
  } catch (error) {
    consola.error('Error clearing incidents:', error);
    return reply.code(500).send({ error: 'Failed to clear incidents' });
  }
});

app.get('/hosts', async (request, reply) => {
  try {
    const incidents = database.getRecentIncidents(1000);
    const hosts = [...new Set(incidents.map(i => i.host))];
    return { hosts, count: hosts.length };
  } catch (error) {
    consola.error('Error fetching hosts:', error);  
    return reply.code(500).send({ error: 'Failed to fetch hosts' });
  }
});

async function startAPI(): Promise<void> {
  const args = parseArgs();
  const config = createConfig(args);
  
  database = new IncidentDatabase(config.dbPath);
  
  try {
    await app.listen({ port: config.apiPort, host: '0.0.0.0' });
    consola.success(`API server running on http://0.0.0.0:${config.apiPort}`);
    consola.info('Available endpoints:');
    consola.info('  GET    /health - Health check');
    consola.info('  GET    /incidents?limit=50&host=example.com - Get incidents');
    consola.info('  GET    /incidents/latest - Get latest incident');
    consola.info('  GET    /incidents/unresolved - Get unresolved incidents');
    consola.info('  PATCH  /incidents/:id/resolve - Mark incident as resolved');
    consola.info('  DELETE /incidents - Clear all incidents');
    consola.info('  GET    /statistics - Get incident statistics');
    consola.info('  GET    /hosts - Get monitored hosts');
  } catch (error) {
    consola.error('Failed to start API server:', error);
    process.exit(1);
  }
}

if (import.meta.main) {
  startAPI();
}

export { startAPI };