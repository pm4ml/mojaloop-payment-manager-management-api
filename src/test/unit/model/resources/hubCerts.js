'use strict';

module.exports = {
    signedCertList:  [
        {
            id: 11,
            csr: '',
            certificate: '',
            state: 'CERT_SIGNED'
        }
    ],

    csrLoadedCertList:  [
        {
            id: 11,
            csr: '-----BEGIN CERTIFICATE REQUEST-----\nMIIE8jCCAtoCAQAwdjELMAkGA1UEBhMCVVMxDTALBgNVBAgTBHRlc3QxDTALBgNV\nBAcTBHRlc3QxDTALBgNVBAoTBHRlc3QxDTALBgNVBAsTBHRlc3QxDTALBgNVBAMT\nBHRlc3QxHDAaBgkqhkiG9w0BCQEMDXRlc3RAdGVzdC5jb20wggIiMA0GCSqGSIb3\nDQEBAQUAA4ICDwAwggIKAoICAQC3sZZqG046JZPbzXdJ/2Cv/hD+cJqLzFRb+Rjb\n/Cu5QdlyxnUJQflqtNb8cOi67fCjutRKNIN5S8thyK/cNAciFwOi2Xf2dWM5uFHC\nLIsbL6dyzhna5vDcUD6TMPgylXnJZqp+t4FrqqpkoRLO78DKSF9mdAo+kkBasgJP\nKnmGhQHP8ro/hpLncjUazlpzGRTBf+RZdL+KxLevx6kCn9V3v9X9sfDRVb5vzZaX\nIZZiw69J8DZEz6fnxoSVql9WIQW+KXZHT8w6Hwkv3PSb+kwfxpSYRnAJF39Th9OV\npVGFwtIgUs+tSbSUlN3l4ycI2fmNYqcB13pWsk2QT8+fk0uFp0EazxKyxZtCUxNq\nZyR+5rctpmO+l7Azqson4xnR0wOhGtyg5kzhLmYTwJwLqoGFGrjsihf1gdQFMRpc\nDRZ/VVCY8cPcaShXHgZ0FAnZXl1qiPd4NUvZY/OczZYQiqlJ9LLcScfwVniz26JT\nWD8sEahrVWLU92h3WkrwFaWdSwpBHdILo9CBM6ZILINaqsGdMAdhYhUDl8buGbcr\nb5QMU7pLlpPd2XTYZP7hcOxwK7HScTaJis5FPIbXKb4qe+8jHuzpqhOz0W/gSl5/\no4O3Y4hJxpgKZRj60Lh6vTtUsudBC1REHEqjqN+8gxiMkG37C8DC/sHlVqoPTLJS\nog5fbwIDAQABoDcwNQYJKoZIhvcNAQkOMSgwJjAkBgNVHREEHTAbggR0ZXN0ggR0\nZXN0gQ10ZXN0QHRlc3QuY29tMA0GCSqGSIb3DQEBDQUAA4ICAQCYusRAvUCXSBQL\n7ZAawJ78wW5LTIqwUF9GHJjrRL/zcY7E3Tlche0OsNtAUNP1nKTpPC8Pbp0rdzEo\n9wNnzTzPC42BYgJsBUyyQe37RMipVNRy9t4RKCU+Qjy7SByEEm0ZsCgjUo/MSFq7\nnWiu3cnM2T2H/aBI92PgyAMf3B33D62L8btixt6nvLq1P3ROCjPb5qBYmbtYybTD\n7DnxfL3MXxpQaM133FPZffmAlVfkwvp5E8RlYLAiph5ASVfMd20zBq6onc3OYQCI\nPaI5WnUnIXe89YDJjkcP0yZ7mHfc9GBtcW33O2bcevgGHZ5j95YO8GBeo8BF16s2\nP5OVsfME8MNmCMefaRjvcAiOcAwkYALpkDZ7iWbRWYpAHZUTUcAU0ScFE/kt9fvJ\nIJse16NQp/Ko7tpZezBHhYxlfpSVXqOqqUjveqa5Ob/XVFTFBFNL6d+PYzpU7FbM\nKUjVK3CRqCz8XctNiUEpA0Gsff/uJTteei7PmsJpI/Xzt8L0L2Eb4u0XNs7wNrSk\nbGT0teK0S8oOMkisAjZ6HxRjdRRn30VAO9HKUVmiUVz/geKfZ8ILXwtNNTQrIxdM\nrclhsOgBOOaIlm+hG+sW4het1SHDPpGQsCyZX65+wAiOs3MMI4+RdtePprAxNLne\nRMll8jEadTdCwtHxkVYzFJ0Tp8o9HQ==\n-----END CERTIFICATE REQUEST-----\n',
            certificate: '',
            state: 'CSR_LOADED'
        }
    ],
    dfspCA: {
        'rootCertificate': '-----BEGIN CERTIFICATE-----\nMIIFajCCA1KgAwIBAgIUL5GpV4BChvDjXOrnZjnwPHkkiQswDQYJKoZIhvcNAQEN\nBQAwTTEKMAgGA1UEBhMBLTEKMAgGA1UECBMBLTEKMAgGA1UEBxMBLTERMA8GA1UE\nChMIREZTUCBPbmUxFDASBgNVBAsTC0RGU1AgT25lIENBMB4XDTIwMDkyODE4MTYw\nMFoXDTI1MDkyNzE4MTYwMFowTTEKMAgGA1UEBhMBLTEKMAgGA1UECBMBLTEKMAgG\nA1UEBxMBLTERMA8GA1UEChMIREZTUCBPbmUxFDASBgNVBAsTC0RGU1AgT25lIENB\nMIICIjANBgkqhkiG9w0BAQEFAAOCAg8AMIICCgKCAgEAvOrezWD1atfuObH+26iR\nY7Kzo1AizJSF4FEX6JKfuXXNESMQab9qUgINz8hcdQ8LEtQeeLfZBm9LTOgkcl/X\nS9IQoP/M7hppgehZ25c8yXnOukmPtqVuIKROGRCZP9XenJx70KI+t24qpV9DfGa6\n6JPdSrzZJNPP4iPdFuuNB+IFcCshUdMFGnvZWMxp/D63C9V5SX8R46EFt4Zc9/4B\nzy4/T70Xay1zhGJJiRtuxsisP+ySOZOkBL/PoGBNOw05LrUgNXX2leKvHwPBFs8e\nItZE2rG93AMCjRxFkG96SoKCuEUFu/kKYMAMLKl8hjvTehDmk0S99/he8rE+ifvf\n+4BL97oromhEvUP+KNGgI87hSmKm+31GQDnML0+2JP0MrA+IxKkmirH+uq6FTk4m\nxoXCzBjK4dtZ80Wivw17D646+3eMBLWQWw5CstWdUxg2vsRcTmdkx4IH0zpu6yPk\nDuon/utbcrZ1Ef8tkRJeY+BfmpQbCHC1a/RlKfR2hOwkZJZxLC4Nm+kGvbLqJfqR\nPGepzNnevUaKOa+TJLN5saJYJl6YQ3wrpfzaadriKugbQUCz/N7r9wihylhvCEGX\nLxuOmdFlMynyL0Axa9wZQP/pMkQqsrNuQ/ImPafsnMJg+pktigvD6wRYJkrhmtPH\n2nbD4uJT4bPy1YqK9tX7VecCAwEAAaNCMEAwDgYDVR0PAQH/BAQDAgEGMA8GA1Ud\nEwEB/wQFMAMBAf8wHQYDVR0OBBYEFIlW4TnZb57JLjCY57BqoBlLAmcvMA0GCSqG\nSIb3DQEBDQUAA4ICAQAGvIMisUqlHnKCJfQhsy2/+NDWwxufi/LahcB5Lou7KHaS\n4QKw9DtDlc6guWdUkGQ0Cdvmu4M7LrXI5pVaPMgYfUhrbl//oXV54TNEUO2lt+iu\nI3oAuH3afeeQSW3w2OPQMxdiveXph6J928LIb9B7tSRWDlnhyF4fiZyvJqz6Fhr7\nZvx6nyGv46bH9pgo3TFvoiwaBEY87ZK5BgtRhQBLoSCKmYuYLDMHQYutYH9W2Mi6\nJ1N2UKwRzh36HTOwzAqEUoUENJfHK7F4zbnMFN08rt3u/b/FKulVe6tMYrtYO8ab\nz9WmbJiLZzNQAZyxlZokA6LyjFAqTzMQm2Knk2O69TS22P9pZtkWMJIjIAYyNdCM\nGQGUyUUHJ28PN3OcGNCNA3bkp+WMDxAttyKj3o6xj6H688+yukCsBXE/yft6WkjZ\niI+JsmJl1OCVEGw4jhWT7tF/I1XhTyvHLcfiu+1W98k82MxoVsI0tTCf8qGLTMsS\noZX1OA6Rv9PP6NyIaVw+jMvv9Wjc/9D/Fa8550ZlmsHGMVZYbr/oYYKrOCaXnb9t\nFM5kiPX8L5Ude12L01FTOLnOuoP97AmKvqMXhmEhAQI0Z27r9Joj2oN6Fg/uh98g\nXp5xHBbVgZZsahD+zq8B3UwuZ0LvbMsHBkr7BxW0K7Phk0rcIwcjsLJOV+GoCg==\n-----END CERTIFICATE-----\n',
        'intermediateChain': null,
        'validations': [
            {
                'data': {},
                'result': 'VALID',
                'details': 'VALID(SELF_SIGNED)',
                'message': 'The root certificate is valid with VALID(SELF_SIGNED) state.',
                'performed': true,
                'validationCode': 'VERIFY_ROOT_CERTIFICATE',
                'messageTemplate': ''
            },
            {
                'data': {},
                'result': 'NOT_AVAILABLE',
                'message': 'No intermediate chain',
                'performed': false,
                'validationCode': 'VERIFY_CHAIN_CERTIFICATES',
                'messageTemplate': ''
            },
            {
                'data': {},
                'result': 'VALID',
                'message': 'The root certificate has the CA basic contraint extension ( CA = true )',
                'performed': true,
                'validationCode': 'CA_CERTIFICATE_USAGE',
                'messageTemplate': ''
            }
        ],
        'validationState': 'VALID'
    }

};