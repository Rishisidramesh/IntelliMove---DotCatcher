from flask import Flask, render_template
from flask_socketio import SocketIO, emit
from kafka import KafkaConsumer, KafkaProducer
import json
import threading
import time

app = Flask(__name__)
app.config['SECRET_KEY'] = 'secret!'
socketio = SocketIO(app, cors_allowed_origins="*")

# Kafka consumers
dots_consumer = None
actions_consumer = None

# Kafka producer for actions
actions_producer = None

# Game state
game_state = {
    'score': 0,
    'misses': 0,
    'game_over': False
}

def consume_dots():
    """Consume dot appearance events from Kafka and broadcast to clients"""
    global dots_consumer
    
    dots_consumer = KafkaConsumer(
        'dots',
        bootstrap_servers='localhost:9092',
        value_deserializer=lambda m: json.loads(m.decode('utf-8'))
    )
    
    for message in dots_consumer:
        event = message.value
        print(f"Received dot event: {event}")
        # Broadcast to all connected clients
        socketio.emit('dot_appeared', event)

def consume_actions():
    """Consume user action events from Kafka and update game state"""
    global actions_consumer
    
    actions_consumer = KafkaConsumer(
        'actions',
        bootstrap_servers='localhost:9092',
        value_deserializer=lambda m: json.loads(m.decode('utf-8'))
    )
    
    for message in actions_consumer:
        event = message.value
        print(f"Received action event: {event}")
        
        if event['event_type'] == 'dot_caught':
            game_state['score'] += 1
        elif event['event_type'] == 'dot_missed':
            game_state['misses'] += 1
            
        # Send updated game state to clients
        socketio.emit('game_state_update', game_state)

@app.route('/')
def index():
    return "Dot Catcher Backend Server"

@socketio.on('connect')
def handle_connect():
    print('Client connected')
    # Send current game state to newly connected client
    emit('game_state_update', game_state)

@socketio.on('disconnect')
def handle_disconnect():
    print('Client disconnected')

@socketio.on('catch_dot')
def handle_catch_dot(data):
    """Handle when a user catches a dot"""
    print(f"User caught dot at position: {data}")
    
    # Send action to Kafka
    if actions_producer:
        event = {
            "event_type": "dot_caught",
            "position": data['position'],
            "timestamp": data['timestamp']
        }
        actions_producer.send('actions', value=event)
        actions_producer.flush()

if __name__ == '__main__':
    # Initialize Kafka producer
    actions_producer = KafkaProducer(
        bootstrap_servers='localhost:9092',
        value_serializer=lambda v: json.dumps(v).encode('utf-8')
    )
    
    # Start Kafka consumers in separate threads
    dots_thread = threading.Thread(target=consume_dots, daemon=True)
    actions_thread = threading.Thread(target=consume_actions, daemon=True)
    
    dots_thread.start()
    actions_thread.start()
    
    # Start Flask server
    socketio.run(app, host='0.0.0.0', port=5001, debug=True, use_reloader=False)