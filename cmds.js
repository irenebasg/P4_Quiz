
const Sequelize = require('sequelize');

const {log, biglog, errorlog, colorize} = require("./out");

const {models} = require("./model");


/**
 * Muestra la Ayuda
 *
 * @param rl Objeto readline usado para implementar el CLI.
 */
exports.helpCmd = (socket,rl) => {
    log(socket, "Comandos");
    log(socket, "   h|help - muestra esta ayuda.");
    log(socket, "   list - Listar los quizzes existentes.");
    log(socket, "   show <id> - Muestra la pregunta y la respuesta el quiz indicado");
    log(socket, "   add - Añadir un nuevo quiz interactivamente.");
    log(socket, "   delete <id> - Borrar el quiz indicado");
    log(socket, "   edit <id> - Editar el quiz indicado");
    log(socket, "   test <id> - Probar el quiz indicado");
    log(socket, "   p|play - Jugar a preguntar aleatoriamente todos los quizzes.");
    log(socket, "   credits - Créditos.");
    log(socket, "   q|quit - Salir del Programa");
    rl.prompt();
};

/**
 * Lista los quizzes existentes
 *
 * @param rl Objeto readline usado para implementar el CLI.
 */

exports.listCmd = (socket, rl) => {

    models.quiz.findAll()
        .each(quiz => {
            log(socket, ` [${colorize(quiz.id, 'magenta')}]: ${quiz.question}`);

        })
        .catch(error => {
            errorlog(socket, error.message);
        })
        .then(() => {
            rl.prompt();
        });
};


/**
 * Esta función devuelve una promesa que:
 *  Valida que se haya introducido un valor para el parámetro.
 *  Convierte el parámetro en un número entero.
 * Si todo va bien, la promesa se satisface y devuelve el valor de id a usar.
 *
 * @param id    Parámetro con el índice a validar.
 */
const validateId = id => {

    return new Sequelize.Promise((resolve, reject) => {
        if (typeof id === 'undefined') {
            reject(new Error(`Falta el parámetro <id>.`));
        } else {
            id = parseInt(id);      // Coger la parte entera y descartar lo demás.
            if (Number.isNaN(id)) {
                reject(new Error(`El valor del parámetro <id> no es un número.`));
            } else {
                resolve(id);
            }
        }
    });
};


/**
 * Muestra el quiz indicado en el parámetro: La pregunta y la respuesta.
 *
 * @param rl    Objeto readline usado para implementar el CLI.
 * @param id Clave del quiz a mostrar.
 */
exports.showCmd = (socket, rl, id) => {

    validateId(id)
        .then(id => models.quiz.findById(id))
        .then(quiz => {
            if (!quiz) {
                throw new Error(`No esxiste un quiz asociado al id=${id}.`);
            }
            log(socket, ` [${colorize(quiz.id, 'magenta')}]: ${quiz.question} ${colorize('=>', 'magenta')} ${quiz.answer}`);
        })
        .catch(error => {
            errorlog(socket, error.message);
        })
        .then(() => {
            rl.prompt();
        });
};



/**
 * Esta función convierte la llamada rl.question, que está basada en callbacks, en una
 * basada en promesas.
 *
 * Esta función devuelve una promesa que cuando se cumple, proporciona el texto introductorio.
 * Entonces la llamada a then que hay que hacer la promesa devuelta será:
 *          .then(answer => {...})
 *
 * También colorea en rojo el texto de la pregunta, elimina espacios al principio y final.
 *
 * @param rl        Objeto readline usado para implementar el CLI.
 * @param text      Pregunta que hay que hacerle al usuario.
 */
const makeQuestion = (rl, text) => {

    return new Sequelize.Promise((resolve, reject) => {
        rl.question(colorize(text, 'red'), answer => {
            resolve(answer.trim());
        });
    });
};



/**
 * Añade un nuevo quiz al modelo.
 * Pregunta interactivamente por la pregunta y por la respuesta.
 *
 * Hay que recordar que el funcionamiento de la función rl.question es asíncrono.
 * El prompt hay que sacarlo cuando ya se ha terminado la interacción con el usuario,
 * es decir, la llamada a rl.prompt() se debe hacer en la callback de la segunda
 * llamada a rl.question.
 *
 * @param rl    Objeto readline usado para implementar el CLI.
 */
exports.addCmd = (socket, rl) => {
    makeQuestion(rl, ' Introduzca una pregunta ')
        .then(q => {
            return makeQuestion(rl, ' Introduzca la respuesta ')
                .then(a => {
                    return { question: q, answer: a };
                });
        })
        .then(quiz => {
            return models.quiz.create(quiz);
        })
        .then((quiz) => {
            log(socket,` ${colorize('Se ha añadido', 'magenta')}: ${quiz.question} ${colorize('=>', 'magenta')} ${quiz.answer}`);
        })
        .catch(Sequelize.ValidationError, error => {
            errorlog(socket, 'El quiz es erróneo');
            error.errors.forEach(({ message }) => errorlog(message));
        })
        .catch(error => {
            errorlog(socket, error.message);
        })
        .then(() => {
            rl.prompt();
        });
};

/**
 * Borra un quiz del modelo.
 *
 * @param rl Objeto readline usado para implementar el CLI.
 * @param id Clave del quiz a borrar en el modelo.
 */
exports.deleteCmd = (socket, rl, id) => {
    validateId(id)
        .then(id => models.quiz.destroy({ where: { id } }))
        .catch(error => {
            errorlog(socket, error.message);
        })
        .then(() => {
            rl.prompt();
        })
};


/**
 * Edita un quiz del modelo.
 *
 * Recordamos que el funcionamiento de la funcion rl.question es asíncrono.
 * El prompt hay que sacarlo cuando ya se ha terminado la interacción con el usuario,
 * es decir, la llamada a rl.prompt() se debe hacer en la callback de la segunda
 * llamada a rl.question.
 *
 * @param rl Objeto readline usado para implementar el CLI.
 * @param id Clave del quiz a editar en el modelo
 */

exports.editCmd = (socket, rl, id) => {
    validateId(id)
        .then(id => models.quiz.findById(id))
        .then(quiz => {
            if (!quiz) {
                throw new Error(`No existe un quiz asociado al id=${id}.`);
            }

            process.stdout.isTTY && setTimeout(() => { rl.write(quiz.question) }, 0);
            return makeQuestion(rl, ' Introduzca la pregunta ')
                .then(q => {
                    process.stdout.isTTY && setTimeout(() => { rl.write(quiz.answer) }, 0);
                    return makeQuestion(rl, ' Introduzca la respuesta ')
                        .then(a => {
                            quiz.question = q;
                            quiz.answer = a;
                            return quiz;
                        });
                });
        })
        .then(quiz => {
            return quiz.save();
        })
        .then(quiz => {
            log(socket, ` Se ha cambiado el quiz ${colorize(quiz.id, 'magenta')} por: ${quiz.question} ${colorize('=>', 'magenta')} ${quiz.answer}`);
        })
        .catch(Sequelize.ValidationError, error => {
            errorlog(socket, 'El quiz es erróneo');
            error.errors.forEach(({ message }) => errorlog(socket, message));
        })
        .catch(error => {
            errorlog(socket, error.message);
        })
        .then(() => {
            rl.prompt();
        });
};


/**
 * Prueba un quiz, es decir, hace una pregunta del modelo a la que debemos contestar.
 *
 * @param rl Objeto readline usado para implementar el CLI.
 * @param id Clave del quiz a probar
 */

exports.testCmd = (socket, rl, id) => {
    validateId(id)
        .then(id => models.quiz.findById(id))
        .then(quiz => {
            if (!quiz) {
                throw new Error(`No existe un quiz asociado al id=${id}.`);
            }



            return makeQuestion(rl, `${quiz.question}? `)
                .then(a => {

                    if (a.toLowerCase().trim() === quiz.answer.toLowerCase().trim()) {
                        //Mensaje de Respuesta
                        log(socket, 'Su respuesta es correcta: ');
                        biglog(socket, 'CORRECTA', 'green');
                        //rl.prompt();
                    } else {
                        //Mensaje de Respuesta
                        log(socket, 'Su respuesta es incorrecta: ');
                        biglog(socket, 'INCORRECTA', 'red');
                        //rl.prompt();
                    }
                });
        })
                        .catch(Sequelize.ValidationError, error => {
                        errorlog(socket, 'El quiz es erróneo');
                        error.errors.forEach(({message}) => errorlog(socket, message));
                    })
                        .catch(error => {
                            errorlog(socket, error.message);
                        })
                        .then(() => {
                            rl.prompt();
                        });

};

/**
 * Pregunta todos los quizzes existentes en el modelo en orden aleatorio.
 * Se gana si se contesta a todos satisfactoriamente.
 *
 * @param rl Objeto readline usado para implementar el CLI.
 */

exports.playCmd = rl => {

    let score=0; //Numero de aciertos
    let toBeResolved = []; //Array con el tamaño del numero de preguntas


    models.quiz.findAll()
        .each(quiz => {
        toBeResolved.push(quiz);
    })
        .then(() => {


    const playOne = () => {


        if (toBeResolved === undefined || toBeResolved.length === 0) {
            // Si el array esta vacío o se ha acabado el juego.
            log(socket, 'No hay más preguntas. Fin del Juego. Ha acertado:');
            biglog(socket, score, 'magenta');
            rl.prompt();
        }
        else {

            let aleatorio = parseInt(Math.random() * (toBeResolved.length));
            let quiz = toBeResolved[aleatorio];
            toBeResolved.splice(aleatorio, 1);

            //let quiz = model.getByIndex(seleccion);
            return makeQuestion(rl, `${quiz.question}? `)
                .then(a => {

                    if (a.toLowerCase().trim() === quiz.answer.toLowerCase().trim()) {
                        //Mensaje de Respuesta
                        score++;
                        socket.write(`CORRECTO - Lleva ${score} aciertos.`);
                        playOne();
                    }
                    else {
                        //Mensaje de Respuesta
                        //log('INCORRECTO');
                        socket.write(`INCORRECTA. Fin del juego. Ha tenido ${score} aciertos:`);
                        //biglog(score, 'magenta');
                        rl.prompt();

                    }

                })
            .catch(Sequelize.ValidationError, error => {
            errorlog(socket, 'El quiz es erróneo');
            error.errors.forEach(({message}) => errorlog(socket, message));
        })
            .catch(error => {
                errorlog(socket, error.message);
            })
            .then(() => {
                rl.prompt();
            });



    }
    };
        playOne();
    })

};







/**
 * Muestra los nombres de los autores de la práctica.
 *
 * @param rl Objeto readline usado para implementar el CLI.
 */

exports.creditsCmd = (socket, rl) => {
    log(socket, 'Autores de la práctica');
    log(socket, 'Eduardo' , 'green');
    log(socket, 'Irene'   , 'green');
    rl.prompt();

};

/**
 * Terminar
 *
 * @param rl Objeto readline usado para implementar el CLI.
 */

exports.quitCmd =(socket, rl) => {
    rl.close();
    socket.end();

};