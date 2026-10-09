<?php

return[
    'import-export' => 'Import/Export',
    'title' => 'Database Import/Export',
    'select-database' => 'Select a database',
    'no-databases' => 'You have no databases to import or export.',

    'export' => [
        'button' => 'Export',
        'success' => 'Your database dump has started downloading.',
        'error' => 'The database could not be exported.',
    ],

    'import' => [
        'button' => 'Import',
        'select-file' => 'Select SQL file',
        'wipe' => 'Wipe database before import',
        'wipe-warning' => 'This will permanently delete all existing tables in the selected database before importing the file.',
        'success' => 'The database was imported successfully.',
        'error' => 'The database could not be imported.',
        'no-file' => 'Please select a .sql file to import.',
    ],

    'cancel' => 'Cancel',
];
