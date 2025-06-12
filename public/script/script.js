$(document).ready(() => {
    carregarEstados();
    inicializarEventos();
});

// Carrega a lista de estados do Brasil da API do IBGE
function carregarEstados() { 
    fetch("https://servicodados.ibge.gov.br/api/v1/localidades/estados?orderBy=nome")
        .then((res) => res.json())
        .then((ufs) => {
            let listaUf = `<option value="" disabled selected>Selecione um estado</option>`;
            for (let uf of ufs) {
                listaUf += `<option value="${uf.id}-${uf.sigla}">${uf.nome}</option>`;
            }
            $("#uf").html(listaUf);
        });
}

// Carrega as cidades do estado selecionado
function listarCidade(e) { 
    const [idEstado] = e.target.value.split('-'); 
    const cidadeSelect = document.getElementById('cidade');

    cidadeSelect.innerHTML = `<option value="" disabled selected>Carregando...</option>`;

    fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${idEstado}/municipios`)
        .then((res) => res.json())
        .then((cidades) => {
            let listaCidades = `<option value="" disabled selected>Selecione uma cidade</option>`;
            for (let cidade of cidades) {
                listaCidades += `<option value="${cidade.nome}">${cidade.nome}</option>`;
            }
            cidadeSelect.innerHTML = listaCidades;
        })
        .catch((error) => {
            console.error('Erro ao carregar cidades:', error);
            cidadeSelect.innerHTML = `<option value="" disabled selected>Erro ao carregar cidades</option>`;
        });
}

// Configuração padrão para os alertas do SweetAlert2
const sweetAlertCustomConfig = {
    customClass: {
        popup: 'swal-custom-popup',
        confirmButton: 'swal2-confirm'
    },
    width: 'auto',
    padding: '1em'
};

// Função principal para buscar um CEP na API ViaCEP
function buscarCEP() {
    // Remove caracteres não numéricos do CEP
    const cepInput = document.getElementById('cep');
    const cep = cepInput.value.replace(/\D/g, '');
    
    // Limpa resultados anteriores
    document.getElementById('retorno').innerHTML = '';
    document.getElementById('map').style.display = 'none';
    
    // Validações do CEP
    if (!cep) {
        Swal.fire({
            ...sweetAlertCustomConfig,
            icon: 'warning',
            title: 'Atenção',
            text: 'Por favor, informe um CEP.'
        });
        return;
    }

    if (cep.length !== 8) {
        Swal.fire({
            icon: 'error',
            title: 'CEP Inválido',
            text: 'O CEP deve conter 8 dígitos.'
        });
        return;
    }

    // Exibe mensagem de busca
    document.getElementById('retorno').innerHTML = '<p>Buscando CEP...</p>';

    // Realiza a consulta na API ViaCEP
    fetch(`https://viacep.com.br/ws/${cep}/json/`)
        .then(response => {
            if (!response.ok) {
                throw new Error('Erro na requisição');
            }
            return response.json();
        })
        .then(data => {
            console.log('Resposta da API:', data);
            if (data.erro) {
                Swal.fire({
                    icon: 'error',
                    title: 'CEP não encontrado',
                    text: 'O CEP informado não existe na base de dados.',
                    confirmButtonText: 'Tentar novamente',
                    confirmButtonColor: '#3085d6',
                    customClass: {
                        popup: 'swal-custom-popup'
                    }
                });
                document.getElementById('retorno').innerHTML = '';
                return;
            }
            mostrarResultadoCEP(data);
            rolagemTela();
        })
        .catch(error => {
            console.error('Erro:', error);
            Swal.fire({
                icon: 'error',
                title: 'Erro na busca',
                text: 'Ocorreu um erro ao buscar o CEP. Tente novamente mais tarde.',
                confirmButtonText: 'OK',
                confirmButtonColor: '#3085d6',
                customClass: {
                    popup: 'swal-custom-popup'
                }
            });
            document.getElementById('retorno').innerHTML = '';
        });
}

// Exibe os resultados do CEP encontrado
function mostrarResultadoCEP(data) {
    const resultado = `
        <div>
            <ul>
                <li><b>CEP:</b> ${data.cep}</li>
                <li><b>Logradouro:</b> ${data.logradouro || 'N/A'}</li>
                <li><b>Complemento:</b> ${data.complemento || 'N/A'}</li>
                <li><b>Bairro:</b> ${data.bairro || 'N/A'}</li>
                <li><b>Cidade:</b> ${data.localidade}</li>
                <li><b>Estado:</b> ${data.uf}</li>
            </ul>
        </div>`;

    document.getElementById('retorno').innerHTML = resultado;

    Swal.fire({
        ...sweetAlertCustomConfig,
        icon: 'success',
        title: 'CEP Encontrado!',
        text: `Endereço encontrado em ${data.localidade}/${data.uf}`,
        timer: 2500,
        timerProgressBar: true,
        position: 'center',
        showConfirmButton: false,
        backdrop: 'rgba(0,0,0,0.4)'
    }).then(() => {
        rolagemTela();
    });

    buscarCoordenadas(data);
}

// Busca as coordenadas geográficas do endereço usando OpenStreetMap
function buscarCoordenadas(data) { 
    // Monta o endereço completo para busca
    const endereco = `${data.logradouro || ''}, ${data.bairro || ''}, ${data.localidade}, ${data.uf}, ${data.cep}`;
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(endereco)}`;

    fetch(url)
        .then(response => response.json())
        .then(locations => {
            if (locations.length === 0) {
                Swal.fire({
                    icon: 'warning',
                    title: 'Mapa indisponível',
                    text: 'Não foi possível carregar o mapa para esta localização.',
                    footer: 'O endereço pode estar incompleto ou incorreto',
                    confirmButtonText: 'Entendi',
                    confirmButtonColor: '#3085d6',
                    customClass: {
                        popup: 'swal-custom-popup'
                    }
                });
                return;
            }

            const { lat, lon } = locations[0]; 
            exibirMapa(lat, lon);
        })
        .catch(error => {
            Swal.fire({
                icon: 'error',
                title: 'Erro ao carregar mapa',
                text: 'Não foi possível carregar o mapa neste momento.',
                footer: 'Verifique sua conexão com a internet',
                confirmButtonText: 'OK',
                confirmButtonColor: '#3085d6',
                customClass: {
                    popup: 'swal-custom-popup'
                }
            });
        });
}

// Variável global para controle da instância do mapa
let map; 

// Exibe o mapa com a localização encontrada
function exibirMapa(lat, lon) {
    // Obtém a referência do elemento do mapa e torna-o visível
    const mapDiv = document.getElementById('map'); 
    mapDiv.style.display = 'block';

    // Remove o mapa anterior se existir para evitar sobreposição
    if (map) {
        map.remove();
    }

    // Inicializa um novo mapa Leaflet com a localização e zoom específicos
    map = L.map('map').setView([lat, lon], 15);

    // Força a atualização do tamanho do mapa após um breve delay
    // Isso evita problemas de renderização quando o mapa está inicialmente oculto
    setTimeout(() => {
        map.invalidateSize();
    }, 100);

    // Adiciona a camada de tiles do OpenStreetMap com atribuição adequada
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    L.marker([lat, lon]).addTo(map)
        .bindPopup('Localização aproximada')
        .openPopup();
}

// Função para busca reversa: encontra CEPs a partir do nome da rua
function buscarRua() {
    const rua = document.getElementById('rua').value.trim();
    const ufValue = document.getElementById('uf').value.trim();
    const cidade = document.getElementById('cidade').value.trim();

    // Validações dos campos de entrada
    if (!rua || !ufValue || !cidade) {
        Swal.fire({
            icon: 'warning',
            title: 'Campos Incompletos',
            text: 'Por favor, preencha todos os campos.'
        });
        return;
    }

    if (rua.length < 3) {
        Swal.fire({
            icon: 'error',
            title: 'Nome da Rua Inválido',
            text: 'O nome da rua deve conter no mínimo 3 caracteres.'
        });
        return;
    }

    const uf = ufValue.split('-')[1];

    if (!uf || uf.length !== 2) {
        Swal.fire({
            icon: 'error',
            title: 'UF Inválida',
            text: 'A UF deve conter 2 caracteres.'
        });
        return;
    }

    // Consulta a API ViaCEP para busca por endereço
    fetch(`https://viacep.com.br/ws/${uf}/${cidade}/${rua}/json/`)
        .then(response => {
            if (!response.ok) throw new Error('Erro ao buscar dados!');
            return response.json();
        })
        .then(data => {
            if (data.erro || !Array.isArray(data)) {
                Swal.fire({
                    icon: 'info',
                    title: 'Sem Resultados',
                    text: 'Dados não encontrados!'
                });
                return;
            }

            const resultadosFiltrados = data.filter(item => {
                const logradouroPalavras = item.logradouro.toLowerCase().split(/\s+/);
                return logradouroPalavras.includes(rua.toLowerCase());
            });

            if (resultadosFiltrados.length === 0) {
                Swal.fire({
                    icon: 'info',
                    title: 'Sem Resultados',
                    text: 'Nenhuma rua encontrada com o trecho informado.'
                });
                return;
            }

            mostrarResultadoRua(resultadosFiltrados);
            rolagemTela();
        })
        .catch(error => {
            Swal.fire({
                icon: 'error',
                title: 'Erro',
                text: 'Erro ao buscar dados: ' + error.message
            });
        });
}

// Exibe os resultados da busca por rua
function mostrarResultadoRua(data) {
    let lista = "";
    let corLinha = "red";

    for (let prop in data) {
        lista += `
            <div>
                <ul>
                    <li style="color:${corLinha};"><b>CEP:</b> <a href="#" onclick="document.getElementById('cep').value='${data[prop].cep}'; buscarCEP(); return false;" style="color:${corLinha};">${data[prop].cep}</a></li>
                    <li style="color:${corLinha};"><b>Logradouro:</b> ${data[prop].logradouro}</li>
                    <li style="color:${corLinha};"><b>Complemento:</b> ${data[prop].complemento}</li>
                    <li style="color:${corLinha};"><b>Bairro:</b> ${data[prop].bairro}</li>
                </ul>
            </div>`;
        corLinha = corLinha === "red" ? "blue" : "red";
    }

    const totalRuas = `
    <div class="resultado-sumario">
        <p>Total de CEPs encontrados: <span class="destaque">${data.length}</span></p>
        <small>Para mais detalhes de localização, clique no CEP desejado</small>
    </div>`;

    document.getElementById('retorno').innerHTML = totalRuas + lista;
    
    Swal.fire({
        icon: 'success',
        title: 'Endereços Encontrados',
        text: `Foram encontrados ${data.length} endereços`,
        timer: 2000,
        timerProgressBar: true,
        position: 'center',
        showConfirmButton: false,
        backdrop: 'rgba(0,0,0,0.4)'
    }).then(() => {
        rolagemTela();
    });
}

// Inicializa todos os eventos necessários para o funcionamento da aplicação
function inicializarEventos() {
    // Máscara para o campo CEP
    document.getElementById('cep').addEventListener('input', function(e) {
        let value = e.target.value.replace(/\D/g, '');
        if (value.length > 8) value = value.substr(0, 8);
        e.target.value = value;
    });

    // Tratamento do formulário e eventos de reset
    const forms = document.getElementsByTagName('form');
    for (let form of forms) {
        form.addEventListener('reset', function(e) {
            e.preventDefault();
            limparDados();
        });
    }

    // Ajustes para responsividade do mapa
    window.addEventListener('orientationchange', function() {
        if (map) {
            setTimeout(() => {
                map.invalidateSize();
            }, 200);
        }
    });

    // Ajuste de altura do mapa para dispositivos móveis
    if (window.innerWidth <= 600) {
        const mapDiv = document.getElementById('map');
        mapDiv.style.height = '250px';
    }
}

// Função auxiliar para rolagem suave até o resultado
function rolagemTela() {
    setTimeout(() => {
        document.getElementById('retornoConsulta').scrollIntoView({
            behavior: 'smooth',
            block: 'center'
        });
    }, 300);
}

// Função para limpar todos os campos e resultados
function limparDados() { 
    document.getElementById('cep').value = '';
    document.getElementById('rua').value = '';
    document.getElementById('cidade').value = '';
    document.getElementById('uf').value = '';
    document.getElementById('retorno').innerHTML = '';

    const mapDiv = document.getElementById('map');
    mapDiv.style.display = 'none';
    mapDiv.innerHTML = '';
}