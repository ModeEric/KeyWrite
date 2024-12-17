// src/App.js

import React, { useState, useEffect, useRef, useMemo } from 'react';
import axios from 'axios';
import {
  Container,
  Box,
  Typography,
  TextField,
  Button,
  IconButton,
  Divider,
  Paper,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Chip,
  AppBar,
  Toolbar,
  Tooltip,
  Snackbar,
  Alert,
  Drawer,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  CircularProgress,
  Avatar,
  Tooltip as MuiTooltip,
} from '@mui/material';
import {
  Edit,
  Delete,
  Send,
  Brightness4,
  Brightness7,
  Menu,
  Refresh,
  HelpOutline,
  AttachFile,
  Person,
  SmartToy,
} from '@mui/icons-material';
import ReactMarkdown from 'react-markdown';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import '@fontsource/poppins'; // Importing the Poppins font
import './App.css';

// Placeholder for illustrative graphic (optional)
import ChatIllustration from './assets/chat-illustration.svg'; // Ensure you have this asset or replace with your own

function App() {
  // State Management
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [messages, setMessages] = useState([
    { sender: 'bot', text: 'Hello! How can I assist you today?' },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [keyTerms, setKeyTerms] = useState([]);
  const [newTerm, setNewTerm] = useState('');
  const [newDefinition, setNewDefinition] = useState('');
  const [newRelevance, setNewRelevance] = useState('');
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [currentEditTerm, setCurrentEditTerm] = useState('');
  const [editDefinition, setEditDefinition] = useState('');
  const [editRelevance, setEditRelevance] = useState('');
  const [darkMode, setDarkMode] = useState(true);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success',
  });
  const [confirmDialog, setConfirmDialog] = useState({
    open: false,
    term: '',
  });
  const [helpModalOpen, setHelpModalOpen] = useState(false);
  const [file, setFile] = useState(null); // For file attachments

  const chatEndRef = useRef(null);

  // Fetch Key Terms on Mount
  useEffect(() => {
    fetchKeyTerms();
    scrollToBottom();
    // eslint-disable-next-line
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const scrollToBottom = () => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // Theme Configuration
  const theme = useMemo(
    () =>
      createTheme({
        palette: {
          mode: darkMode ? 'dark' : 'light',
          primary: {
            main: darkMode ? '#BB86FC' : '#6200EE',
          },
          secondary: {
            main: darkMode ? '#03DAC6' : '#03A9F4',
          },
          background: {
            default: darkMode ? '#121212' : '#F0F2F5',
            paper: darkMode ? '#1E1E1E' : '#FFFFFF',
          },
          text: {
            primary: darkMode ? '#FFFFFF' : '#000000',
            secondary: darkMode ? '#AAAAAA' : '#555555',
          },
        },
        typography: {
          fontFamily: 'Poppins, sans-serif',
        },
        components: {
          MuiPaper: {
            styleOverrides: {
              root: {
                borderRadius: '12px',
              },
            },
          },
          MuiButton: {
            styleOverrides: {
              root: {
                borderRadius: '20px',
                textTransform: 'none',
                fontWeight: 'bold',
              },
            },
          },
        },
      }),
    [darkMode]
  );

  // Fetch Key Terms
  const fetchKeyTerms = async () => {
    try {
      const response = await axios.get('http://127.0.0.1:8000/key-terms');
      const keyTermsData = response.data.key_terms || {};

      const keyTermsArray = Object.entries(keyTermsData).map(
        ([term, details]) => ({
          term,
          definition: details.definition,
          relevance: details.relevance,
        })
      );

      setKeyTerms(keyTermsArray);
    } catch (error) {
      console.error('Error fetching key terms:', error);
      showSnackbar('Error fetching key terms.', 'error');
    }
  };

  // Send Message
  const sendMessage = async () => {
    if (input.trim() === '' && !file) return;

    let userMessage = { sender: 'user', text: input };
    if (file) {
      userMessage.text += ` [File Attached: ${file.name}]`;
    }
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      let formData = new FormData();
      formData.append('message', input);
      if (file) {
        formData.append('file', file);
      }

      const response = await axios.post('http://127.0.0.1:8000/chat', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      const botMessage = { sender: 'bot', text: response.data.reply };
      setMessages((prev) => [...prev, botMessage]);
      fetchKeyTerms();
      if (file) setFile(null); // Reset file after upload
    } catch (error) {
      console.error('Error sending message:', error);
      const errorMessage = { sender: 'bot', text: 'Sorry, something went wrong.' };
      setMessages((prev) => [...prev, errorMessage]);
      showSnackbar('Error sending message.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Key Term Handlers
  const handleAddKeyTerm = async () => {
    if (newTerm.trim() === '') return;
    try {
      await axios.post('http://127.0.0.1:8000/key-terms', {
        term: newTerm,
        definition: newDefinition,
        relevance: newRelevance || 'Low',
      });
      fetchKeyTerms();
      setNewTerm('');
      setNewDefinition('');
      setNewRelevance('');
      showSnackbar('Key term added successfully.', 'success');
    } catch (error) {
      console.error('Error adding key term:', error);
      showSnackbar('Error adding key term.', 'error');
    }
  };

  const handleDeleteKeyTerm = async (term) => {
    try {
      await axios.delete(`http://127.0.0.1:8000/key-terms/${encodeURIComponent(term)}`);
      fetchKeyTerms();
      showSnackbar(`Deleted key term: ${term}`, 'info');
    } catch (error) {
      console.error('Error deleting key term:', error);
      showSnackbar('Error deleting key term.', 'error');
    }
  };

  const openEditDialog = (term) => {
    const termDetails = keyTerms.find((kt) => kt.term === term);
    if (termDetails) {
      setCurrentEditTerm(term);
      setEditDefinition(termDetails.definition);
      setEditRelevance(termDetails.relevance);
      setEditDialogOpen(true);
    }
  };

  const handleEditKeyTerm = async () => {
    try {
      await axios.put(`http://127.0.0.1:8000/key-terms/${encodeURIComponent(currentEditTerm)}`, {
        definition: editDefinition,
        relevance: editRelevance,
      });
      fetchKeyTerms();
      setEditDialogOpen(false);
      showSnackbar('Key term updated successfully.', 'success');
    } catch (error) {
      console.error('Error editing key term:', error);
      showSnackbar('Error editing key term.', 'error');
    }
  };

  // Snackbar Handler
  const showSnackbar = (message, severity) => {
    setSnackbar({
      open: true,
      message,
      severity,
    });
  };

  const handleCloseSnackbar = () => {
    setSnackbar({ ...snackbar, open: false });
  };

  // Confirmation Dialog Handler
  const handleConfirmDelete = (term) => {
    setConfirmDialog({
      open: true,
      term,
    });
  };

  const handleConfirmDeleteAction = async () => {
    await handleDeleteKeyTerm(confirmDialog.term);
    setConfirmDialog({
      open: false,
      term: '',
    });
  };

  // File Upload Handler
  const handleFileUpload = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      showSnackbar(`File ${selectedFile.name} attached.`, 'success');
    }
  };

  return (
    <ThemeProvider theme={theme}>
      <AppBar position="fixed" color="primary">
        <Toolbar>
          <IconButton
            color="inherit"
            edge="start"
            onClick={() => setIsDrawerOpen(true)}
            aria-label="open key terms drawer"
            sx={{ mr: 2 }}
          >
            <Menu />
          </IconButton>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            AI Assistant
          </Typography>
          <MuiTooltip title="Toggle light/dark theme">
            <IconButton
              color="inherit"
              onClick={() => setDarkMode(!darkMode)}
              edge="end"
              aria-label="toggle light dark theme"
            >
              {darkMode ? <Brightness7 /> : <Brightness4 />}
            </IconButton>
          </MuiTooltip>
        </Toolbar>
      </AppBar>

      {/* Drawer for Key Terms */}
      <Drawer
        anchor="left"
        open={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        variant="temporary"
        ModalProps={{
          keepMounted: true, // Better open performance on mobile.
        }}
        sx={{
          '& .MuiDrawer-paper': {
            width: { xs: '80%', sm: 350 },
          },
        }}
      >
        <Box
          sx={{ width: '100%', p: 2 }}
          role="presentation"
        >
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6">Manage Key Terms</Typography>
            <Box>
              <MuiTooltip title="Refresh Key Terms">
                <IconButton onClick={fetchKeyTerms} aria-label="refresh key terms">
                  <Refresh />
                </IconButton>
              </MuiTooltip>
              <MuiTooltip title="Learn about Key Terms">
                <IconButton onClick={() => setHelpModalOpen(true)} aria-label="learn about key terms">
                  <HelpOutline />
                </IconButton>
              </MuiTooltip>
            </Box>
          </Box>
          <Divider sx={{ mb: 2 }} />

          {/* Current Key Terms */}
          <Box sx={{ mb: 4 }}>
            <Typography variant="subtitle1" gutterBottom>
              Current Key Terms
            </Typography>
            <List>
              {keyTerms.length === 0 && (
                <Box sx={{ textAlign: 'center', mt: 2 }}>
                  <img src={ChatIllustration} alt="No key terms" style={{ width: '80%', opacity: 0.7 }} />
                  <Typography variant="body2" sx={{ mt: 1 }}>
                    No key terms available. Add some to get started!
                  </Typography>
                </Box>
              )}
              {keyTerms.map(({ term, definition, relevance }) => (
                <ListItem key={term} button onClick={() => openEditDialog(term)}>
                  <ListItemText
                    primary={term}
                    secondary={`Relevance: ${relevance}`}
                  />
                  <ListItemSecondaryAction>
                    <MuiTooltip title="Delete Key Term">
                      <IconButton edge="end" onClick={() => handleConfirmDelete(term)} aria-label={`delete ${term}`}>
                        <Delete />
                      </IconButton>
                    </MuiTooltip>
                  </ListItemSecondaryAction>
                </ListItem>
              ))}
            </List>
          </Box>

          <Divider sx={{ mb: 2 }} />

          {/* Add New Key Term */}
          <Typography variant="subtitle1" gutterBottom>
            Add New Key Term
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              label="Term"
              variant="outlined"
              value={newTerm}
              onChange={(e) => setNewTerm(e.target.value)}
              required
              aria-label="new term"
            />
            <TextField
              label="Definition"
              variant="outlined"
              value={newDefinition}
              onChange={(e) => setNewDefinition(e.target.value)}
              required
              multiline
              rows={3}
              aria-label="new term definition"
            />
            <TextField
              label="Relevance"
              variant="outlined"
              value={newRelevance}
              onChange={(e) => setNewRelevance(e.target.value)}
              placeholder="e.g., High, Medium, Low"
              helperText="Determine the importance of the key term."
              required
              aria-label="new term relevance"
            />
            <Button
              variant="contained"
              color="secondary"
              onClick={handleAddKeyTerm}
              disabled={newTerm.trim() === ''}
              aria-label="add key term"
              sx={{
                background: 'linear-gradient(45deg, #FE6B8B 30%, #FF8E53 90%)',
                boxShadow: '0 3px 5px 2px rgba(255, 105, 135, .3)',
                '&:hover': {
                  background: 'linear-gradient(45deg, #FF8E53 30%, #FE6B8B 90%)',
                },
              }}
            >
              Add Key Term
            </Button>
          </Box>
        </Box>
      </Drawer>

      {/* Help Modal */}
      <Dialog open={helpModalOpen} onClose={() => setHelpModalOpen(false)}>
        <DialogTitle>About Key Terms</DialogTitle>
        <DialogContent>
          <Typography variant="body1">
            Key terms help the AI understand important concepts related to your queries. You can add, edit, or delete key terms to customize the AI's responses.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setHelpModalOpen(false)} aria-label="close help modal">Close</Button>
        </DialogActions>
      </Dialog>

      {/* Confirmation Dialog for Deletion */}
      <Dialog
        open={confirmDialog.open}
        onClose={() => setConfirmDialog({ open: false, term: '' })}
        aria-labelledby="confirm-delete-title"
        aria-describedby="confirm-delete-description"
      >
        <DialogTitle id="confirm-delete-title">Confirm Delete</DialogTitle>
        <DialogContent>
          <Typography id="confirm-delete-description">
            Are you sure you want to delete the key term "{confirmDialog.term}"?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDialog({ open: false, term: '' })} aria-label="cancel delete">Cancel</Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleConfirmDeleteAction}
            aria-label="confirm delete"
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Main Content */}
      <Container
        maxWidth="md"
        sx={{
          mt: 8,
          display: 'flex',
          flexDirection: 'column',
          height: 'calc(100vh - 64px)',
        }}
      >
        <Paper
          elevation={3}
          sx={{
            flexGrow: 1,
            display: 'flex',
            flexDirection: 'column',
            p: 2,
            backgroundColor: theme.palette.background.paper,
            borderRadius: 3,
            backdropFilter: 'blur(10px)',
            backgroundColor: darkMode ? 'rgba(30,30,30,0.8)' : 'rgba(255,255,255,0.8)',
            border: '1px solid rgba(255, 255, 255, 0.3)',
          }}
        >
          {/* Chat Messages */}
          <Box
            sx={{
              flexGrow: 1,
              overflowY: 'auto',
              mb: 2,
              pr: 1,
            }}
          >
            {messages.map((msg, index) => (
              <Box
                key={index}
                sx={{
                  display: 'flex',
                  flexDirection: msg.sender === 'user' ? 'row-reverse' : 'row',
                  alignItems: 'flex-start',
                  mb: 1,
                }}
              >
                <MuiTooltip title={msg.sender === 'user' ? 'You' : 'Bot'}>
                  <Avatar sx={{ bgcolor: msg.sender === 'user' ? 'primary.main' : 'secondary.main', mr: msg.sender === 'user' ? 0 : 1, ml: msg.sender === 'user' ? 1 : 0 }}>
                    {msg.sender === 'user' ? <Person /> : <SmartToy />}
                  </Avatar>
                </MuiTooltip>
                <Box
                  sx={{
                    bgcolor: msg.sender === 'user' ? 'primary.main' : 'grey.700',
                    color: 'white',
                    px: 2,
                    py: 1,
                    borderRadius: 2,
                    maxWidth: '80%',
                    boxShadow: 1,
                    animation: 'fadeIn 0.3s ease-in-out',
                    position: 'relative',
                  }}
                >
                  <Typography variant="body1">
                    <ReactMarkdown
                      components={{
                        a: ({ node, ...props }) => <a {...props} target="_blank" rel="noopener noreferrer" />,
                        img: ({ node, ...props }) => (
                          <Box
                            component="img"
                            src={props.src}
                            alt={props.alt}
                            sx={{ maxWidth: '100%', borderRadius: 2, mt: 1 }}
                          />
                        ),
                      }}
                    >
                      {msg.text}
                    </ReactMarkdown>
                  </Typography>
                  {/* Timestamp */}
                  <Typography variant="caption" sx={{ position: 'absolute', bottom: -18, right: 8 }}>
                    {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </Typography>
                </Box>
              </Box>
            ))}
            {loading && (
              <Box sx={{ display: 'flex', justifyContent: 'flex-start', mb: 1 }}>
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    bgcolor: 'grey.700',
                    color: 'white',
                    px: 2,
                    py: 1,
                    borderRadius: 2,
                    maxWidth: '80%',
                  }}
                >
                  <Box className="typing-indicator" sx={{ display: 'flex' }}>
                    <div></div>
                    <div></div>
                    <div></div>
                  </Box>
                </Box>
              </Box>
            )}
            <div ref={chatEndRef} />
          </Box>

          {/* Message Input */}
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            {/* File Attachment */}
            <MuiTooltip title="Attach File">
              <IconButton component="label" aria-label="attach file">
                <AttachFile />
                <input type="file" hidden onChange={handleFileUpload} />
              </IconButton>
            </MuiTooltip>
            <TextField
              fullWidth
              variant="outlined"
              placeholder="Type your message..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              multiline
              maxRows={4}
              sx={{
                mr: 1,
                backgroundColor: theme.palette.background.default,
                borderRadius: 2,
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                '& .MuiOutlinedInput-root': {
                  borderRadius: 2,
                },
              }}
              aria-label="message input"
            />
            <Button
              variant="contained"
              color="primary"
              onClick={sendMessage}
              disabled={loading}
              endIcon={<Send />}
              aria-label="send message"
              sx={{
                background: 'linear-gradient(45deg, #FE6B8B 30%, #FF8E53 90%)',
                boxShadow: '0 3px 5px 2px rgba(255, 105, 135, .3)',
                '&:hover': {
                  background: 'linear-gradient(45deg, #FF8E53 30%, #FE6B8B 90%)',
                },
              }}
            >
              Send
            </Button>
          </Box>
        </Paper>
      </Container>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)}>
        <DialogTitle>Edit Key Term: {currentEditTerm}</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
          <TextField
            label="Definition"
            variant="outlined"
            value={editDefinition}
            onChange={(e) => setEditDefinition(e.target.value)}
            multiline
            rows={3}
            required
            aria-label="edit term definition"
          />
          <TextField
            label="Relevance"
            variant="outlined"
            value={editRelevance}
            onChange={(e) => setEditRelevance(e.target.value)}
            placeholder="e.g., High, Medium, Low"
            required
            aria-label="edit term relevance"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)} aria-label="cancel edit">Cancel</Button>
          <Button
            variant="contained"
            color="primary"
            onClick={handleEditKeyTerm}
            aria-label="save edit"
            sx={{
              background: 'linear-gradient(45deg, #BB86FC 30%, #6200EE 90%)',
              boxShadow: '0 3px 5px 2px rgba(187, 134, 252, .3)',
              '&:hover': {
                background: 'linear-gradient(45deg, #6200EE 30%, #BB86FC 90%)',
              },
            }}
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar for Notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={handleCloseSnackbar} severity={snackbar.severity} sx={{ width: '100%' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </ThemeProvider>
  );
}

export default App;
